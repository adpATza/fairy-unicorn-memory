class_name MemoryDeckLibrary
extends RefCounted
const ROOT := "user://decks"
const VERSION := 1
var decks: Array = []
var errors: Array[String] = []

func discover() -> Array:
	decks.clear()
	errors.clear()
	var index = _json("res://assets/decks/library.json")
	if index is Array:
		for path in index:
			_load_manifest(str(path), true)
	DirAccess.make_dir_recursive_absolute(ROOT)
	for folder in DirAccess.get_directories_at(ROOT):
		if folder.begins_with("custom_"):
			_load_manifest(ROOT.path_join(folder).path_join("manifest.json"), false)
	return decks

func _json(path: String):
	if not FileAccess.file_exists(path):
		return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func _load_manifest(path: String, builtin: bool) -> void:
	var data = _json(path)
	if not valid_manifest(data):
		errors.append("Skipped invalid deck manifest: " + path)
		return
	data["builtin"] = builtin
	data["base"] = path.get_base_dir()
	for entry in data.images:
		entry["image"] = data.base.path_join(entry.path)
		if not FileAccess.file_exists(entry.image) and not ResourceLoader.exists(entry.image):
			errors.append("Deck has a missing image: " + str(data.title))
			return
	decks.append(data)

func valid_manifest(data) -> bool:
	if not data is Dictionary or data.get("version", 0) != VERSION:
		return false
	for key in ["id", "title", "domain", "style", "complexity"]:
		if not data.get(key) is String or str(data[key]).strip_edges().is_empty():
			return false
	if data.style not in ["Illustrated", "Realistic fantasy", "Other"] or data.complexity not in ["Easy", "Medium", "Hard"]:
		return false
	if not data.get("images") is Array or data.images.size() < 2 or data.images.size() > 30:
		return false
	var ids := {}
	var paths := {}
	for entry in data.images:
		if not entry is Dictionary or not entry.get("pair_id") is String or not entry.get("path") is String:
			return false
		var p: String = entry.path
		if entry.pair_id.is_empty() or ids.has(entry.pair_id) or paths.has(p) or p.is_empty() or p.is_absolute_path() or ":" in p or ".." in p or "\\" in p:
			return false
		ids[entry.pair_id] = true
		paths[p] = true
	return true

static func decoded_hash(image: Image) -> String:
	var rgba := image.duplicate() as Image
	rgba.convert(Image.FORMAT_RGBA8)
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(("%s,%s:" % [rgba.get_width(), rgba.get_height()]).to_utf8_buffer())
	hashing.update(rgba.get_data())
	return hashing.finish().hex_encode()

static func normalize(image: Image, edge: int = 1024) -> Image:
	var content := image.duplicate() as Image
	content.convert(Image.FORMAT_RGBA8)
	var factor := float(edge) * 0.9 / maxf(content.get_width(), content.get_height())
	content.resize(maxi(1, roundi(content.get_width() * factor)), maxi(1, roundi(content.get_height() * factor)), Image.INTERPOLATE_LANCZOS)
	var square := Image.create(edge, edge, false, Image.FORMAT_RGBA8)
	square.fill(Color("fff9f0"))
	square.blend_rect(content, Rect2i(Vector2i.ZERO, content.get_size()), (Vector2i(edge, edge) - content.get_size()) / 2)
	return square

func scan_folder(folder: String) -> Dictionary:
	var result := {"accepted": [], "rejected": []}
	var seen := {}
	var dir := DirAccess.open(folder)
	if dir == null:
		result.rejected.append("Cannot open this folder. Choose a readable local image folder.")
		return result
	var files := dir.get_files()
	files.sort()
	for filename in files:
		if filename.get_extension().to_lower() not in ["png", "jpg", "jpeg", "webp"]:
			continue
		var path := folder.path_join(filename)
		var image := Image.new()
		if image.load(path) != OK or image.is_empty():
			result.rejected.append(filename + ": unreadable or corrupt image.")
			continue
		var digest := decoded_hash(image)
		if seen.has(digest):
			result.rejected.append(filename + ": identical decoded pixels to " + str(seen[digest]) + ". Select one copy per object.")
			continue
		seen[digest] = filename
		result.accepted.append({"source": path, "filename": filename, "hash": digest, "preview": ImageTexture.create_from_image(normalize(image, 160))})
	return result

func save_import(title: String, domain: String, style: String, complexity: String, selected: Array) -> Dictionary:
	if title.strip_edges().is_empty() or domain.strip_edges().is_empty():
		return {"error": "Enter a deck name and domain."}
	if selected.size() < 2 or selected.size() > 30:
		return {"error": "Select between 2 and 30 unique images."}
	if style not in ["Illustrated", "Realistic fantasy", "Other"] or complexity not in ["Easy", "Medium", "Hard"]:
		return {"error": "Choose a supported style and complexity."}
	var id := "custom_" + Crypto.new().generate_random_bytes(12).hex_encode()
	var staging := ROOT.path_join(".staging_" + id)
	DirAccess.make_dir_recursive_absolute(staging)
	var entries := []
	var seen := {}
	for i in range(selected.size()):
		var image := Image.new()
		if image.load(selected[i].source) != OK or image.is_empty():
			_cleanup(staging)
			return {"error": "An image can no longer be read. Choose the folder again."}
		var digest := decoded_hash(image)
		if seen.has(digest) or digest != selected[i].hash:
			_cleanup(staging)
			return {"error": "An image changed or is duplicated. Review the folder again."}
		seen[digest] = true
		var filename := "%02d.png" % (i + 1)
		if normalize(image).save_png(staging.path_join(filename)) != OK:
			_cleanup(staging)
			return {"error": "Could not copy images to local storage. Check free space and permissions."}
		entries.append({"pair_id": "%s_%02d" % [id, i + 1], "path": filename})
	var manifest := {"version": VERSION, "id": id, "title": title.strip_edges().left(64), "domain": domain.strip_edges().left(40), "style": style, "complexity": complexity, "images": entries}
	if not _write_json(staging.path_join("manifest.json"), manifest):
		_cleanup(staging)
		return {"error": "Could not save the deck manifest."}
	var destination := ROOT.path_join(id)
	if DirAccess.rename_absolute(staging, destination) != OK:
		_cleanup(staging)
		return {"error": "Could not finish saving the deck."}
	discover()
	return {"id": id}

func _write_json(path: String, data: Dictionary) -> bool:
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	return DirAccess.rename_absolute(path + ".tmp", path) == OK

func rename_deck(deck: Dictionary, title: String) -> bool:
	if deck.get("builtin", true) or title.strip_edges().is_empty() or not _safe_custom(deck):
		return false
	var data = _json(str(deck.base).path_join("manifest.json"))
	if not valid_manifest(data):
		return false
	data.title = title.strip_edges().left(64)
	return _write_json(str(deck.base).path_join("manifest.json"), data)

func delete_deck(deck: Dictionary) -> bool:
	if deck.get("builtin", true) or not _safe_custom(deck):
		return false
	return _cleanup(deck.base)

func _safe_custom(deck: Dictionary) -> bool:
	var id: String = deck.get("id", "")
	if not id.begins_with("custom_") or id.length() != 31:
		return false
	return str(deck.get("base", "")).simplify_path() == ROOT.path_join(id)

func _cleanup(path: String) -> bool:
	# Only flat, app-created folders. Never recurse or follow a source folder.
	if path.get_base_dir() != ROOT or not path.get_file().begins_with("custom_") and not path.get_file().begins_with(".staging_custom_"):
		return false
	for file in DirAccess.get_files_at(path):
		if DirAccess.remove_absolute(path.path_join(file)) != OK:
			return false
	return DirAccess.remove_absolute(path) == OK

func texture(path: String) -> Texture2D:
	if path.begins_with("res://"):
		return load(path) as Texture2D
	var image := Image.new()
	if image.load(path) != OK:
		return null
	return ImageTexture.create_from_image(image)
