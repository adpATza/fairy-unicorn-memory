class_name MemoryStorage
extends RefCounted
## Copy-only upgrade: existing new data wins; the previous installation is untouched.
const LEGACY_DIRECTORY := "Fairy and Unicorn Memory"

static func migrate_legacy(source_root: String = "", target_root: String = "") -> Dictionary:
	var result := {"decks": 0, "preferences": false, "issues": []}
	if source_root.is_empty():
		var appdata := OS.get_environment("APPDATA")
		if appdata.is_empty():
			return result
		source_root = appdata.path_join(LEGACY_DIRECTORY)
	if target_root.is_empty():
		target_root = ProjectSettings.globalize_path("user://")
	source_root = source_root.replace("\\", "/").simplify_path().trim_suffix("/")
	target_root = target_root.replace("\\", "/").simplify_path().trim_suffix("/")
	if source_root == target_root or not DirAccess.dir_exists_absolute(source_root):
		return result
	var marker := target_root.path_join("migration-v2.json")
	if FileAccess.file_exists(marker):
		return result
	DirAccess.make_dir_recursive_absolute(target_root)
	var preferences := source_root.path_join("preferences.cfg")
	var destination := target_root.path_join("preferences.cfg")
	if FileAccess.file_exists(preferences) and not FileAccess.file_exists(destination):
		if DirAccess.copy_absolute(preferences, destination) == OK:
			result.preferences = true
		else:
			result.issues.append("Your previous settings could not be copied.")
	var decks := source_root.path_join("decks")
	var destination_decks := target_root.path_join("decks")
	DirAccess.make_dir_recursive_absolute(destination_decks)
	var validator := MemoryDeckLibrary.new()
	var folders := DirAccess.get_directories_at(decks) if DirAccess.dir_exists_absolute(decks) else PackedStringArray()
	for folder in folders:
		if not folder.begins_with("custom_") or folder.length() != 31:
			continue
		var source := decks.path_join(folder)
		var target := destination_decks.path_join(folder)
		if DirAccess.dir_exists_absolute(target):
			continue
		var manifest := source.path_join("manifest.json")
		var data = JSON.parse_string(FileAccess.get_file_as_string(manifest)) if FileAccess.file_exists(manifest) else null
		if not validator.valid_manifest(data) or data.id != folder:
			result.issues.append("A previous deck has an invalid manifest: " + folder)
			continue
		var files: Array = ["manifest.json"]
		var valid := true
		for entry in data.images:
			if str(entry.path).get_file() != str(entry.path) or not FileAccess.file_exists(source.path_join(entry.path)):
				valid = false
				break
			files.append(entry.path)
		if not valid:
			result.issues.append("A previous deck has missing images: " + str(data.title))
			continue
		var staging := destination_decks.path_join(".upgrade_" + folder)
		DirAccess.make_dir_recursive_absolute(staging)
		for file in files:
			if DirAccess.copy_absolute(source.path_join(file), staging.path_join(file)) != OK:
				valid = false
				break
		if valid and DirAccess.rename_absolute(staging, target) == OK:
			result.decks += 1
		else:
			result.issues.append("A previous deck could not be copied: " + str(data.title))
	if result.issues.is_empty():
		var file := FileAccess.open(marker, FileAccess.WRITE)
		if file:
			file.store_string(JSON.stringify({"version": 2, "copied_decks": result.decks, "copied_preferences": result.preferences}))
			file.close()
	return result
