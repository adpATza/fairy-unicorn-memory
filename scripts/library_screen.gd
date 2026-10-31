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
	StoryUI.place(view, self, Rect2(0, 0, 1280, 720))

func _show_library() -> void:
	_clear()
	app.library.discover()
	StoryUI.label(view, "Your little worlds", Rect2(44, 27, 850, 70), 46, StoryUI.INK, true)
	StoryUI.button(view, "Return to setup", Rect2(1032, 39, 204, 43), app.show_setup)
	StoryUI.label(view, "Six illustrated collections, and room for your own.", Rect2(48, 105, 900, 28), 20, StoryUI.MUTED)
	var scroll := ScrollContainer.new()
	StoryUI.place(scroll, view, Rect2(44, 155, 670, 516))
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 12)
	scroll.add_child(list)
	for deck in app.library.decks:
		var row := Control.new()
		row.custom_minimum_size = Vector2(642, 132)
		list.add_child(row)
		StoryUI.panel(row, Rect2(0, 0, 642, 128), Color("fffaf3"), 15)
		StoryUI.texture(row, app.library.texture(deck.images[0].image), Rect2(12, 11, 106, 106))
		StoryUI.label(row, deck.title, Rect2(137, 11, 466, 34), 25, StoryUI.INK, true)
		StoryUI.label(row, "%s  /  %s  /  %s" % [deck.domain, deck.style, deck.complexity], Rect2(139, 50, 480, 25), 16, StoryUI.MUTED)
		StoryUI.label(row, "%d images%s" % [deck.images.size(), "  •  included" if deck.builtin else "  •  your collection"], Rect2(139, 86, 275, 24), 16, StoryUI.MUTED)
		if not deck.builtin:
			StoryUI.button(row, "Rename", Rect2(407, 84, 100, 32), func(): _rename(deck))
			StoryUI.button(row, "Delete", Rect2(520, 84, 100, 32), func():
				app.confirm_action("Delete this custom deck?", 'Delete “%s” from this game?\nYour original image folder stays untouched.' % deck.title, func():
					if not app.library.delete_deck(deck):
						app.notice("Could not delete this deck. Check that its files are writable.")
					_show_library(), Callable(), "Delete deck"))
	StoryUI.panel(view, Rect2(759, 155, 477, 516), Color("eee5f2"), 34)
	StoryUI.label(view, "Make it personal", Rect2(798, 190, 399, 45), 32, StoryUI.INK, true)
	var info := StoryUI.label(view, "Bring your own fairies, unicorns,\nor a completely different world.\n\nChoose 2–30 unique pictures.\nWe’ll fit them onto square cards\nand save a copy in this game.", Rect2(800, 254, 395, 211), 21, StoryUI.MUTED)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	StoryUI.button(view, "Import an image folder", Rect2(798, 496, 399, 52), _choose_folder, true)
	StoryUI.button(view, "Artwork & import guide", Rect2(798, 564, 399, 46), app.show_guide)
	if not app.library.errors.is_empty():
		StoryUI.button(view, "Review library warnings", Rect2(48, 679, 330, 32), func(): app.notice("\n".join(app.library.errors)))

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
	StoryUI.label(view, "Create a deck", Rect2(38, 24, 950, 61), 43, StoryUI.INK, true)
	StoryUI.label(view, "Review the square previews, then select 2–30 unique pictures.", Rect2(41, 93, 1100, 28), 19, StoryUI.MUTED)
	StoryUI.button(view, "Cancel import", Rect2(1050, 37, 191, 42), _show_library)
	var scroll := ScrollContainer.new()
	StoryUI.place(scroll, view, Rect2(34, 151, 844, 492))
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
		tile.add_theme_stylebox_override("normal", StoryUI.box(Color("fffaf3"), 10, StoryUI.LINE, 1))
		tile.add_theme_stylebox_override("pressed", StoryUI.box(Color("e0cce9"), 10, StoryUI.PLUM, 3))
		grid.add_child(tile)
		StoryUI.texture(tile, item.preview, Rect2(8, 8, 110, 110))
		var l := StoryUI.label(tile, item.filename, Rect2(9, 124, 108, 22), 13)
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		l.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		tile.toggled.connect(func(enabled):
			if enabled:
				chosen[i] = true
			else:
				chosen.erase(i)
			_update_count())
		import_buttons.append(tile)
	StoryUI.panel(view, Rect2(909, 151, 332, 492), Color("eee5f2"), 24)
	StoryUI.label(view, "Deck name", Rect2(930, 169, 280, 26), 17)
	title_field = StoryUI.line(view, "", Rect2(930, 202, 290, 43), "My magical collection")
	title_field.max_length = 64
	StoryUI.label(view, "Domain / subject", Rect2(930, 259, 280, 26), 17)
	domain_field = StoryUI.line(view, "Fairies", Rect2(930, 290, 290, 43), "Fairies, unicorns, birds…")
	StoryUI.label(view, "Artwork style", Rect2(930, 347, 280, 26), 17)
	style_field = StoryUI.option(view, ["Illustrated", "Realistic fantasy", "Other"], "Illustrated", Rect2(930, 378, 290, 43))
	StoryUI.label(view, "Complexity", Rect2(930, 435, 280, 26), 17)
	complexity_field = StoryUI.option(view, ["Easy", "Medium", "Hard"], "Easy", Rect2(930, 466, 290, 43))
	StoryUI.label(view, "Tags describe your artwork.\nThey don’t change the pictures.", Rect2(930, 542, 290, 60), 16, StoryUI.MUTED)
	selected_label = StoryUI.label(view, "", Rect2(38, 663, 450, 34), 18)
	StoryUI.button(view, "Clear selection", Rect2(491, 663, 177, 37), func():
		chosen.clear()
		for button in import_buttons:
			button.set_pressed_no_signal(false)
		_update_count())
	if not scan.rejected.is_empty():
		StoryUI.button(view, "%d rejected files" % scan.rejected.size(), Rect2(679, 663, 200, 37), func(): app.notice("\n".join(scan.rejected).left(4500)))
	save_button = StoryUI.button(view, "Save deck", Rect2(909, 660, 332, 43), _save_import, true)
	_update_count()
	if scan.accepted.is_empty():
		StoryUI.label(view, "No readable unique images were found.\nChoose a folder containing PNG, JPEG, or WebP images.", Rect2(68, 223, 770, 130), 23, StoryUI.MUTED)

func _update_count() -> void:
	selected_label.text = "%d selected from %d unique images" % [chosen.size(), scan.accepted.size()]
	selected_label.add_theme_color_override("font_color", StoryUI.PLUM if chosen.size() >= 2 and chosen.size() <= 30 else Color("a54656"))
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
