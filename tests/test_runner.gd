extends Node
## Run from source or exported EXE: --headless -- --self-test
var failures: Array[String] = []
var checks := 0
var summaries: Array[String] = []
var lib := MemoryDeckLibrary.new()
var app
var min_scattered := 999.0

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)

func run(application) -> void:
	app = application
	if "--persistence-check" in OS.get_cmdline_user_args():
		_persistence()
		_finish()
		return
	_test_decks()
	_test_layouts()
	_test_sessions()
	_test_imports()
	await _test_screens()
	_finish()

func _finish() -> void:
	var report := {"checks": checks, "failures": failures, "summaries": summaries, "min_scattered_card": min_scattered, "engine": Engine.get_version_info().string, "exported": not OS.has_feature("editor")}
	var file := FileAccess.open("user://qa-report.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	file.close()
	for summary in summaries:
		print(summary)
	print("MEMORY_QA: %d checks; %d failures" % [checks, failures.size()])
	get_tree().quit(0 if failures.is_empty() else 1)

func _test_decks() -> void:
	lib.discover()
	var builtins := 0
	var hashes := {}
	DirAccess.make_dir_recursive_absolute("user://qa-artwork")
	for deck in lib.decks:
		if not deck.builtin:
			continue
		builtins += 1
		check(deck.images.size() == 30, deck.id + " has 30 images")
		var sheet := Image.create(600, 500, false, Image.FORMAT_RGBA8)
		sheet.fill(Color("fff9f0"))
		for i in range(deck.images.size()):
			var tex := lib.texture(deck.images[i].image)
			check(tex != null and tex.get_width() == tex.get_height(), "Readable square artwork: " + deck.images[i].image)
			if tex == null:
				continue
			var image := tex.get_image()
			var digest := MemoryDeckLibrary.decoded_hash(image)
			check(not hashes.has(digest), "Unique decoded built-in artwork " + deck.images[i].pair_id)
			hashes[digest] = true
			image.convert(Image.FORMAT_RGBA8)
			image.resize(100, 100, Image.INTERPOLATE_LANCZOS)
			sheet.blit_rect(image, Rect2i(0, 0, 100, 100), Vector2i((i % 6) * 100, (i / 6) * 100))
		sheet.save_png("user://qa-artwork/" + deck.id + ".png")
	check(builtins == 6 and hashes.size() == 180, "Exactly six 30-image starter decks")
	summaries.append("Artwork: 6 decks, 180 distinct decoded illustrations; six thumbnail sheets saved.")

func _test_layouts() -> void:
	var boards := 0
	for pairs in range(2, 31):
		for scattered in [true, false]:
			for seed_number in range(50):
				var rects := MemoryLayout.generate(pairs * 2, scattered, seed_number)
				check(rects.size() == pairs * 2, "Full layout %d/%s/%d" % [pairs, scattered, seed_number])
				for i in range(rects.size()):
					check(MemoryLayout.AREA.encloses(rects[i]), "No clipping")
					check(is_equal_approx(rects[i].size.x, rects[i].size.y), "Square cards")
					if scattered:
						min_scattered = minf(min_scattered, rects[i].size.x)
					for j in range(i):
						check(not rects[i].grow(4.9).intersects(rects[j].grow(4.9)), "No overlap; at least 9.8 pixels separation")
				if scattered:
					var same_y := true
					for rect in rects:
						if absf(rect.position.y - rects[0].position.y) > 1:
							same_y = false
					check(not same_y, "Scattered positions are irregular")
				boards += 1
	# Uniform transforms preserve separation/shape at minimum, wide and tall sizes.
	var fixed := MemoryLayout.generate(60, true, 87234)
	var before := fixed.duplicate()
	for dimensions in [Vector2(1280, 720), Vector2(1920, 1080), Vector2(1600, 1200), Vector2(2560, 1080)]:
		var transform := MemoryLayout.canvas_transform(dimensions)
		for rect in fixed:
			var mapped: Rect2 = transform * rect
			check(Rect2(Vector2.ZERO, dimensions).encloses(mapped), "Resize stays in viewport")
			check(is_equal_approx(mapped.size.x, mapped.size.y), "Resize scales uniformly")
	check(fixed == before, "Resize never changes stored coordinates")
	summaries.append("Layout: %d boards (2–30 pairs, both layouts, 50 seeds each); no overlaps/clipping; fixed transforms checked." % boards)

func _entries() -> Array:
	return lib.decks[0].images

func _pair(session: MemorySession, wanted: bool) -> Array:
	for i in range(session.cards.size()):
		if session.cards[i].matched:
			continue
		for j in range(i + 1, session.cards.size()):
			if not session.cards[j].matched and (session.cards[i].pair_id == session.cards[j].pair_id) == wanted:
				return [i, j]
	return []

func _test_sessions() -> void:
	for player_count in range(1, 5):
		for keep_turn in [true, false]:
			for pairs in range(2, 31):
				var s := MemorySession.new()
				s.start(_entries(), pairs, ["A", "B", "C", "D"].slice(0, player_count), keep_turn, 39471 + pairs)
				var counts := {}
				for card in s.cards:
					counts[card.pair_id] = counts.get(card.pair_id, 0) + 1
				check(counts.size() == pairs and s.cards.size() == pairs * 2, "Requested number of distinct pairs")
				for value in counts.values():
					check(value == 2, "Exactly two cards per pair ID")
				check(not s.select(-1) and not s.select(s.cards.size()), "Ignore invalid selections")
				# Four mismatches exercise player wraparound, timing and rapid input.
				for attempt in range(4):
					var p := _pair(s, false)
					var active := s.active_player
					check(s.select(p[0]), "First card accepted")
					check(not s.select(p[0]) and s.state == MemorySession.State.SECOND, "Repeated click ignored")
					check(s.select(p[1]), "Second different card accepted")
					check(not s.select((p[1] + 1) % s.cards.size()), "Rapid third click blocked during resolution")
					s.tick(1.49)
					check(s.state == MemorySession.State.RESOLVING and s.visible_card(p[0]), "Mismatch visible for full 1.5 seconds")
					var elapsed := s.elapsed
					var remaining := s.resolution_left
					s.set_paused(true)
					s.tick(100.0)
					check(s.elapsed == elapsed and s.resolution_left == remaining and not s.visible_card(p[0]), "Pause freezes elapsed and resolution, conceals artwork")
					check(not s.select(p[0]), "Pause blocks selection")
					s.set_paused(false)
					s.tick(0.011)
					check(s.state == MemorySession.State.FIRST and s.selections.is_empty(), "Mismatch clears at original positions")
					check(s.active_player == (active + 1) % player_count, "Mismatch advances and wraps player")
				while s.remaining > 0:
					var p := _pair(s, true)
					var active := s.active_player
					var old_scores := s.scores.duplicate()
					s.select(p[0])
					s.select(p[1])
					s.tick(0.64)
					check(not s.cards[p[0]].matched, "Match briefly remains visible")
					s.tick(0.011)
					check(s.cards[p[0]].matched and s.cards[p[1]].matched and s.scores[active] == old_scores[active] + 1, "Match removes exactly the pair and scores one")
					check(s.active_player == (active if keep_turn else (active + 1) % player_count), "Match turn rule")
					var score_total := 0
					for score in s.scores:
						score_total += score
					check(score_total == pairs - s.remaining, "Scores equal matched pairs")
				check(s.state == MemorySession.State.FINISHED and s.attempts == pairs + 4 and not s.select(0), "Final pair ends once, attempts correct, input closed")
				var done_time := s.elapsed
				s.tick(20)
				check(s.elapsed == done_time, "Final completion clock stops")
				s.start(_entries(), pairs, ["Solo"], true, 999)
				check(s.attempts == 0 and s.elapsed == 0 and s.selections.is_empty() and s.state == MemorySession.State.FIRST, "Restart fully resets pending resolution")
	var tied := MemorySession.new()
	tied.start(_entries(), 2, ["A", "B", "C", "D"], true, 1)
	tied.scores = [3, 1, 3, 0]
	check(tied.winners() == ["A", "C"], "All tied winners reported")
	summaries.append("Rules: 232 complete rounds; 1–4 players, both extra-turn rules, all pair counts, 1.5s mismatch, rapid input, pause, restart and final resolution.")

func _test_imports() -> void:
	var source := "user://qa_sources_魔法_é"
	DirAccess.make_dir_recursive_absolute(source)
	var wide := Image.create(220, 80, false, Image.FORMAT_RGBA8)
	wide.fill(Color("f9c777"))
	wide.fill_rect(Rect2i(10, 10, 40, 60), Color("79558d"))
	wide.save_png(source.path_join("fairy_魔法.png"))
	wide.save_webp(source.path_join("same_pixels.webp"), false)
	var tall := Image.create(80, 220, false, Image.FORMAT_RGBA8)
	tall.fill(Color("b5d4cb"))
	tall.fill_rect(Rect2i(10, 10, 60, 40), Color("79558d"))
	tall.save_png(source.path_join("unicorn_é.png"))
	var jpeg := Image.create(90, 90, false, Image.FORMAT_RGB8)
	jpeg.fill(Color("4499bb"))
	jpeg.save_jpg(source.path_join("jpeg.jpg"), 0.95)
	var corrupt := FileAccess.open(source.path_join("broken.png"), FileAccess.WRITE)
	corrupt.store_string("not an image")
	corrupt.close()
	print("EXPECTED_IMPORT_ERROR_BEGIN: deliberately corrupt PNG")
	var scanned := lib.scan_folder(source)
	print("EXPECTED_IMPORT_ERROR_END")
	check(scanned.accepted.size() == 3 and scanned.rejected.size() == 2, "Unicode PNG and JPEG accepted; corrupt PNG and identical decoded WebP rejected")
	var normalized := MemoryDeckLibrary.normalize(wide)
	check(normalized.get_size() == Vector2i(1024, 1024), "Imports normalize to 1024 square")
	check(normalized.get_pixel(0, 0).is_equal_approx(Color("fff9f0")), "Non-square art fitted onto cream background")
	# Orange bounds retain aspect ratio; no crop or stretch.
	var lower := Vector2i(1024, 1024)
	var upper := Vector2i.ZERO
	for y in range(1024):
		for x in range(1024):
			if not normalized.get_pixel(x, y).is_equal_approx(Color("fff9f0")):
				lower = lower.min(Vector2i(x, y))
				upper = upper.max(Vector2i(x, y))
	var bounds := upper - lower + Vector2i.ONE
	check(absf(float(bounds.x) / bounds.y - 220.0 / 80.0) < 0.03, "Fit preserves non-square aspect ratio")
	check(lib.save_import("", "Fairies", "Illustrated", "Easy", scanned.accepted).has("error"), "Empty import title rejected")
	check(lib.save_import("Short", "Fairies", "Illustrated", "Easy", [scanned.accepted[0]]).has("error"), "Single-image deck rejected")
	check(lib.save_import("Repeated", "Fairies", "Illustrated", "Easy", [scanned.accepted[0], scanned.accepted[0]]).has("error"), "Duplicates revalidated at save")
	var too_many: Array = []
	for _i in range(31):
		too_many.append(scanned.accepted[0])
	check(lib.save_import("Too many", "Fairies", "Illustrated", "Easy", too_many).has("error"), "More than 30 selected images rejected")
	var created := lib.save_import("QA 魔法 deck", "Fairies", "Realistic fantasy", "Medium", scanned.accepted)
	check(created.has("id"), "Import saved")
	var untouched := Image.load_from_file(source.path_join("fairy_魔法.png"))
	check(MemoryDeckLibrary.decoded_hash(untouched) == MemoryDeckLibrary.decoded_hash(wide), "Original source pixels remain untouched")
	if not created.has("id"):
		return
	var deck: Dictionary = {}
	for d in lib.decks:
		if d.id == created.id:
			deck = d
	check(not deck.is_empty() and deck.images.size() == 3, "Saved manifest rediscovered")
	var source_moved := source + "_moved"
	DirAccess.rename_absolute(source, source_moved)
	var fresh := MemoryDeckLibrary.new()
	fresh.discover()
	for d in fresh.decks:
		if d.id == created.id:
			for image in d.images:
				check(fresh.texture(image.image) != null, "Saved import survives missing source folder")
	check(fresh.rename_deck(deck, "Renamed 魔法 collection"), "Custom deck rename saved")
	check(not fresh.delete_deck(lib.decks[0]), "Built-in deletion forbidden")
	check(not fresh.delete_deck({"builtin": false, "id": created.id, "base": "E:/"}), "External destination deletion guard")
	# Persist one fixture for a second fresh OS process, then remove source fixtures.
	var state := FileAccess.open("user://qa-persistence.json", FileAccess.WRITE)
	state.store_string(JSON.stringify({"id": created.id, "title": "Renamed 魔法 collection"}))
	state.close()
	for filename in DirAccess.get_files_at(source_moved):
		DirAccess.remove_absolute(source_moved.path_join(filename))
	DirAccess.remove_absolute(source_moved)
	var disposable := fresh.save_import("Delete test", "Birds", "Other", "Hard", [])
	check(disposable.has("error"), "Empty deck rejected")
	app.preferences.sound = false
	app.preferences.reduced_motion = true
	app.save_preferences()
	summaries.append("Import: PNG/WebP, corrupt files, decoded duplicates, Unicode paths, aspect-preserving normalization, atomic storage, rename and missing source. Restart fixture saved.")

func _persistence() -> void:
	var state = JSON.parse_string(FileAccess.get_file_as_string("user://qa-persistence.json"))
	check(state is Dictionary, "Persistence fixture exists from earlier process")
	if not state is Dictionary:
		return
	lib.discover()
	var found := false
	for deck in lib.decks:
		if deck.id == state.id:
			found = true
			check(deck.title == state.title and deck.images.size() == 3, "Renamed deck survives fresh process")
			for image in deck.images:
				var tex := lib.texture(image.image)
				check(tex != null and tex.get_size() == Vector2(1024, 1024), "Imported textures survive restart with source absent")
			check(lib.delete_deck(deck), "Custom deck copies can be deleted")
	check(found, "Imported deck available in fresh process")
	app.load_preferences()
	check(not app.preferences.sound and app.preferences.reduced_motion, "Sound and reduced motion persisted")
	summaries.append("Fresh-process persistence: imported images, renamed manifest and preferences loaded; confirmed custom-only deletion succeeds.")

func _capture(name_value: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("user://" + name_value + ".png")

func _test_screens() -> void:
	app.show_setup()
	await get_tree().process_frame
	check(app.screen.name == "Setup", "Setup scene loads")
	await _capture("setup")
	app.show_library()
	await get_tree().process_frame
	check(app.screen.name == "DeckLibrary", "Library scene loads")
	await _capture("library")
	app.screen.scan = {"accepted": [], "rejected": []}
	app.screen._show_import()
	await get_tree().process_frame
	check(app.screen.save_button.disabled, "Empty import cannot be saved")
	var many_folder := "user://qa_many_31"
	DirAccess.make_dir_recursive_absolute(many_folder)
	for i in range(31):
		var picture := Image.create(20, 20, false, Image.FORMAT_RGBA8)
		picture.fill(Color.from_hsv(float(i) / 31, 0.5, 0.8))
		picture.save_png(many_folder.path_join("%02d.png" % i))
	app.screen._load_folder(many_folder)
	check(app.screen.scan.accepted.size() == 31 and app.screen.chosen.is_empty() and app.screen.save_button.disabled, "Larger folders require manually selecting a subset")
	app.screen.import_buttons[0].button_pressed = true
	app.screen.import_buttons[1].button_pressed = true
	check(not app.screen.save_button.disabled and app.screen.chosen.size() == 2, "Two selected images enable save")
	await _capture("import-preview")
	for button in app.screen.import_buttons:
		button.button_pressed = true
	check(app.screen.save_button.disabled, "31 selected thumbnails cannot be saved")
	for filename in DirAccess.get_files_at(many_folder):
		DirAccess.remove_absolute(many_folder.path_join(filename))
	DirAccess.remove_absolute(many_folder)
	app.show_guide()
	await get_tree().process_frame
	check(app.screen.name == "AdultGuide", "In-game guide scene loads")
	await _capture("guide")
	var config := {"players": 1, "names": ["Alice", "Ben", "Cara", "Duke"], "pairs": 12, "layout": "Scattered", "extra_turn": true}
	app.start_round(config, lib.decks[0])
	await get_tree().process_frame
	await _capture("scattered-default-12-pairs")
	config.players = 4
	config.pairs = 30
	app.start_round(config, lib.decks[0])
	await get_tree().process_frame
	var g = app.game
	check(g.card_nodes.size() == 60, "Maximum board renders sixty reusable cards")
	var original_rects: Array = []
	for card in g.card_nodes:
		original_rects.append(Rect2(card.position, card.size))
		check("Face-down" in card.tooltip_text and not card.tooltip_text.contains("fairies"), "Neutral hidden-card labels")
	await _capture("scattered-30-pairs")
	var p := _pair(g.session, false)
	g.session.select(p[0])
	g.session.select(p[1])
	g.set_paused(true)
	check(g.session.paused and g.pause_layer.visible, "Pause overlay shown")
	for card in g.card_nodes:
		check(not card.revealed, "Pause conceals all artwork nodes")
	await _capture("paused")
	g.set_paused(false)
	check(g.card_nodes[p[0]].revealed and g.card_nodes[p[1]].revealed, "Unpause restores underlying selections")
	g.session.tick(2.0)
	p = _pair(g.session, true)
	g.session.select(p[0])
	g.session.select(p[1])
	g.session.tick(0.7)
	check(not g.card_nodes[p[0]].visible and not g.card_nodes[p[1]].visible, "Matched card nodes removed visually")
	for i in range(g.card_nodes.size()):
		check(Rect2(g.card_nodes[i].position, g.card_nodes[i].size) == original_rects[i], "No remaining cards move after match")
	if DisplayServer.get_name() != "headless":
		var previous_size := DisplayServer.window_get_size()
		DisplayServer.window_set_size(Vector2i(1600, 1000))
		await get_tree().process_frame
		await get_tree().process_frame
		for i in range(g.card_nodes.size()):
			check(Rect2(g.card_nodes[i].position, g.card_nodes[i].size) == original_rects[i], "Native window resize never rearranges or resizes logical cards")
		check(get_window().content_scale_size == Vector2i(1280, 720) and get_window().content_scale_aspect == Window.CONTENT_SCALE_ASPECT_KEEP, "Native window preserves fixed-aspect canvas")
		await _capture("resized-letterbox")
		DisplayServer.window_set_size(previous_size)
		await get_tree().process_frame
	config.pairs = 2
	config.players = 1
	config.layout = "Grid"
	app.start_round(config, lib.decks[3])
	await get_tree().process_frame
	g = app.game
	check(g.session.attempts == 0 and g.session.state == MemorySession.State.FIRST, "Screen restart discards outstanding mismatch callbacks")
	while g.session.remaining > 0:
		p = _pair(g.session, true)
		g.session.select(p[0])
		g.session.select(p[1])
		g.session.tick(0.7)
	# Restart in the same frame as the last match, before its deferred UI result.
	app.start_round(config, lib.decks[3])
	g = app.game
	await get_tree().process_frame
	check(app.screen.name == "Gameplay" and g.session.state == MemorySession.State.FIRST, "Stale final-pair callback cannot replace a restarted round")
	while g.session.remaining > 0:
		p = _pair(g.session, true)
		g.session.select(p[0])
		g.session.select(p[1])
		g.session.tick(0.7)
	await get_tree().process_frame
	await get_tree().process_frame
	check(app.screen.name == "Results", "Final-pair resolution opens result screen")
	await _capture("results")
	app.show_results({"names": ["Alexandria the fairy", "魔法のユニコーンと妖精の世界", "Cara", "Duke"], "scores": [2, 2, 1, 0], "winners": ["Alexandria the fairy", "魔法のユニコーンと妖精の世界"], "attempts": 8, "elapsed": 30.0, "config": config, "deck": lib.decks[0]})
	await get_tree().process_frame
	await _capture("multiplayer-tie")
	summaries.append("Scene integration: setup, library, empty import, guide, 60-card board, pause concealment, match removal without movement, restart and results.")
