extends Control
var app
var view: Control
var scan: Dictionary
var chosen: Dictionary = {}
var title_field: LineEdit
var domain_field: LineEdit
var style_field: OptionButton
var complexity_field: OptionButton
var selected_label: Label
var save_button: Button
var import_buttons: Array[Button] = []

func _ready() -> void:
	_show_library()

func _clear() -> void:
	if is_instance_valid(view):
		remove_child(view)
		view.queue_free()
	view = Control.new()
	GameUI.place(view, self, Rect2(0, 0, 1280, 720))

func _show_library() -> void:
	_clear()
	app.library.discover()
	GameUI.label(view, "Deck library", Rect2(44, 27, 850, 70), 46, GameUI.INK, true)
	GameUI.button(view, "Return to setup", Rect2(1032, 39, 204, 43), app.show_setup)
	GameUI.label(view, "Six bold collections. Your next favourite is in here.", Rect2(48, 105, 900, 28), 20, GameUI.MUTED)
	var scroll := ScrollContainer.new()
	GameUI.place(scroll, view, Rect2(44, 155, 670, 516))
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 12)
	scroll.add_child(list)
	for deck in app.library.decks:
		var row := Control.new()
		row.custom_minimum_size = Vector2(642, 132)
		list.add_child(row)
		GameUI.panel(row, Rect2(0, 0, 642, 128), Color.WHITE, 15)
		GameUI.texture(row, app.library.texture(deck.images[0].image), Rect2(12, 11, 106, 106))
		GameUI.label(row, deck.title, Rect2(137, 11, 466, 34), 25, GameUI.INK, true)
		GameUI.label(row, "%s  /  %s  /  %s" % [deck.domain, deck.style, deck.complexity], Rect2(139, 50, 480, 25), 16, GameUI.MUTED)
		GameUI.label(row, "%d images%s" % [deck.images.size(), "  •  included" if deck.builtin else "  •  your collection"], Rect2(139, 86, 275, 24), 16, GameUI.MUTED)
		if not deck.builtin:
			GameUI.button(row, "Rename", Rect2(407, 84, 100, 32), func(): _rename(deck))
			GameUI.button(row, "Delete", Rect2(520, 84, 100, 32), func():
				app.confirm_action("Delete this custom deck?", 'Delete “%s” from this game?\nYour original image folder stays untouched.' % deck.title, func():
					if not app.library.delete_deck(deck):
						app.notice("Could not delete this deck. Check that its files are writable.")
					_show_library(), Callable(), "Delete deck"))
	GameUI.panel(view, Rect2(759, 155, 477, 516), Color("dcecff"), 34)
	GameUI.label(view, "Build your own deck", Rect2(798, 190, 399, 45), 32, GameUI.INK, true)
	var info := GameUI.label(view, "Animals, vehicles, places,\npeople, or your own artwork.\n\nChoose 2–30 unique pictures.\nReview the square previews,\nthen save and start matching.", Rect2(800, 254, 395, 211), 21, GameUI.MUTED)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	GameUI.button(view, "Import an image folder", Rect2(798, 496, 399, 52), _choose_folder, true)
	GameUI.button(view, "Artwork & import guide", Rect2(798, 564, 399, 46), app.show_guide)
	if not app.library.errors.is_empty():
		GameUI.button(view, "Review library warnings", Rect2(48, 679, 330, 32), func(): app.notice("\n".join(app.library.errors)))

func _rename(deck: Dictionary) -> void:
	var dialog := ConfirmationDialog.new()
	dialog.title = "Rename deck"
	dialog.ok_button_text = "Save name"
	var input := LineEdit.new()
	input.text = deck.title
	input.max_length = 64
	input.custom_minimum_size = Vector2(440, 48)
	dialog.add_child(input)
	add_child(dialog)
	dialog.confirmed.connect(func():
		if not app.library.rename_deck(deck, input.text):
			app.notice("Enter a deck name and check that local storage is writable.")
		dialog.queue_free()
		_show_library())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered(Vector2i(480, 140))
	input.grab_focus()
	input.select_all()

func _choose_folder() -> void:
	var dialog := FileDialog.new()
	dialog.title = "Choose a folder of unique card images"
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_DIR
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.use_native_dialog = true
	add_child(dialog)
	dialog.dir_selected.connect(func(folder):
		_load_folder(folder)
		dialog.queue_free())
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered(Vector2i(1050, 610))

func _load_folder(folder: String) -> void:
	scan = app.library.scan_folder(folder)
	chosen.clear()
	if scan.accepted.size() <= 30:
		for i in range(scan.accepted.size()):
			chosen[i] = true
	_show_import()

func _show_import() -> void:
	_clear()
	import_buttons.clear()
	GameUI.label(view, "Create a deck", Rect2(38, 24, 950, 61), 43, GameUI.INK, true)
	GameUI.label(view, "Review the square previews, then select 2–30 unique pictures.", Rect2(41, 93, 1100, 28), 19, GameUI.MUTED)
	GameUI.button(view, "Cancel import", Rect2(1050, 37, 191, 42), _show_library)
	var scroll := ScrollContainer.new()
	GameUI.place(scroll, view, Rect2(34, 151, 844, 492))
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(grid)
	for i in range(scan.accepted.size()):
		var item: Dictionary = scan.accepted[i]
		var tile := Button.new()
		tile.toggle_mode = true
		tile.button_pressed = chosen.has(i)
		tile.custom_minimum_size = Vector2(126, 154)
		tile.tooltip_text = item.filename + " — normalized without cropping"
		tile.add_theme_stylebox_override("normal", GameUI.box(Color.WHITE, 10, GameUI.LINE, 1))
		tile.add_theme_stylebox_override("pressed", GameUI.box(Color("c6f3e8"), 10, GameUI.ACCENT, 3))
		grid.add_child(tile)
		GameUI.texture(tile, item.preview, Rect2(8, 8, 110, 110))
		var l := GameUI.label(tile, item.filename, Rect2(9, 124, 108, 22), 13)
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		l.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		tile.toggled.connect(func(enabled):
			if enabled:
				chosen[i] = true
			else:
				chosen.erase(i)
			_update_count())
		import_buttons.append(tile)
	GameUI.panel(view, Rect2(909, 151, 332, 492), Color("dcecff"), 24)
	GameUI.label(view, "Deck name", Rect2(930, 169, 280, 26), 17)
	title_field = GameUI.line(view, "", Rect2(930, 202, 290, 43), "My awesome collection")
	title_field.max_length = 64
	GameUI.label(view, "Domain / subject", Rect2(930, 259, 280, 26), 17)
	domain_field = GameUI.line(view, "My collection", Rect2(930, 290, 290, 43), "Animals, vehicles, places…")
	GameUI.label(view, "Artwork style", Rect2(930, 347, 280, 26), 17)
	style_field = GameUI.option(view, ["Illustrated", "Realistic", "Other"], "Illustrated", Rect2(930, 378, 290, 43))
	GameUI.label(view, "Complexity", Rect2(930, 435, 280, 26), 17)
	complexity_field = GameUI.option(view, ["Easy", "Medium", "Hard"], "Easy", Rect2(930, 466, 290, 43))
	GameUI.label(view, "Tags describe your artwork.\nThey don’t change the pictures.", Rect2(930, 542, 290, 60), 16, GameUI.MUTED)
	selected_label = GameUI.label(view, "", Rect2(38, 663, 450, 34), 18)
	GameUI.button(view, "Clear selection", Rect2(491, 663, 177, 37), func():
		chosen.clear()
		for button in import_buttons:
			button.set_pressed_no_signal(false)
		_update_count())
	if not scan.rejected.is_empty():
		GameUI.button(view, "%d rejected files" % scan.rejected.size(), Rect2(679, 663, 200, 37), func(): app.notice("\n".join(scan.rejected).left(4500)))
	save_button = GameUI.button(view, "Save deck", Rect2(909, 660, 332, 43), _save_import, true)
	_update_count()
	if scan.accepted.is_empty():
		GameUI.label(view, "No readable unique images were found.\nChoose a folder containing PNG, JPEG, or WebP images.", Rect2(68, 223, 770, 130), 23, GameUI.MUTED)

func _update_count() -> void:
	selected_label.text = "%d selected from %d unique images" % [chosen.size(), scan.accepted.size()]
	selected_label.add_theme_color_override("font_color", GameUI.ACCENT if chosen.size() >= 2 and chosen.size() <= 30 else Color("a54656"))
	if is_instance_valid(save_button):
		save_button.disabled = chosen.size() < 2 or chosen.size() > 30

func _save_import() -> void:
	var selected: Array = []
	var indices: Array = chosen.keys()
	indices.sort()
	for index in indices:
		selected.append(scan.accepted[index])
	var result: Dictionary = app.library.save_import(title_field.text, domain_field.text, style_field.text, complexity_field.text, selected)
	if result.has("error"):
		app.notice(result.error)
	else:
		_show_library()
