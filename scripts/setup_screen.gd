extends Control
var app
var cfg: Dictionary
var domain: OptionButton
var style: OptionButton
var complexity: OptionButton
var deck_choice: OptionButton
var players: OptionButton
var name_fields: Array[LineEdit] = []
var pair_count: SpinBox
var layout_choice: OptionButton
var extra: CheckBox
var sample_root: Control
var candidates: Array = []

func _ready() -> void:
	cfg = app.preferences.duplicate(true)
	StoryUI.label(self, "Fairy & Unicorn\nMemory", Rect2(54, 35, 700, 124), 49, StoryUI.INK, true)
	StoryUI.label(self, "A little wonder. A perfect pair.", Rect2(58, 169, 630, 30), 21, StoryUI.MUTED)
	StoryUI.button(self, "Deck library", Rect2(903, 33, 151, 42), _library)
	StoryUI.button(self, "Adult guide", Rect2(1070, 33, 156, 42), _guide)
	StoryUI.label(self, "Who’s playing?", Rect2(58, 226, 600, 28), 22, StoryUI.INK, true)
	players = StoryUI.option(self, ["Just me", "2 players", "3 players", "4 players"], ["Just me", "2 players", "3 players", "4 players"][cfg.players - 1], Rect2(58, 264, 160, 43))
	players.item_selected.connect(func(_i): _names())
	for i in range(4):
		var f := StoryUI.line(self, str(cfg.names[i]), Rect2(234 + (i % 2) * 207, 258 + (i / 2) * 48, 195, 40), "Player %d" % (i + 1))
		f.max_length = 18
		f.tooltip_text = "Name for player %d" % (i + 1)
		name_fields.append(f)
	_names()
	StoryUI.label(self, "Choose your little world", Rect2(58, 357, 600, 28), 22, StoryUI.INK, true)
	var domains: Array = []
	for deck in app.library.decks:
		if deck.domain not in domains:
			domains.append(deck.domain)
	domain = StoryUI.option(self, domains, cfg.domain, Rect2(58, 397, 184, 43))
	domain.tooltip_text = "Subject domain"
	style = StoryUI.option(self, [], "", Rect2(254, 397, 196, 43))
	style.tooltip_text = "Artwork style"
	complexity = StoryUI.option(self, [], "", Rect2(462, 397, 184, 43))
	complexity.tooltip_text = "Visual complexity"
	deck_choice = StoryUI.option(self, [], "", Rect2(58, 451, 588, 43))
	domain.item_selected.connect(func(_i): _filter_styles())
	style.item_selected.connect(func(_i): cfg.style = style.text; _filter_complexity())
	complexity.item_selected.connect(func(_i): cfg.complexity = complexity.text; _filter_decks())
	deck_choice.item_selected.connect(func(_i): _sample())
	StoryUI.label(self, "Pairs", Rect2(58, 514, 120, 25), 17, StoryUI.MUTED)
	pair_count = SpinBox.new()
	pair_count.min_value = 2
	pair_count.max_value = 30
	pair_count.step = 1
	pair_count.value = cfg.pairs
	pair_count.rounded = true
	StoryUI.place(pair_count, self, Rect2(58, 544, 130, 43))
	StoryUI.label(self, "Card layout", Rect2(208, 514, 170, 25), 17, StoryUI.MUTED)
	layout_choice = StoryUI.option(self, ["Scattered", "Grid"], cfg.layout, Rect2(208, 544, 180, 43))
	extra = CheckBox.new()
	extra.text = "Another turn\nafter a match"
	extra.button_pressed = cfg.extra_turn
	StoryUI.place(extra, self, Rect2(408, 535, 260, 57))
	StoryUI.button(self, "Let’s play", Rect2(58, 618, 235, 55), _start, true).grab_focus()
	StoryUI.label(self, "Find the pairs. Keep the magic.", Rect2(314, 632, 350, 25), 17, StoryUI.MUTED)
	StoryUI.panel(self, Rect2(730, 111, 496, 543), Color("efe7f1"), 88)
	sample_root = Control.new()
	add_child(sample_root)
	var sound := CheckBox.new()
	sound.text = "Sound"
	sound.button_pressed = cfg.sound
	StoryUI.place(sound, self, Rect2(759, 674, 145, 30))
	sound.toggled.connect(func(v): app.preferences.sound = v; app.save_preferences())
	var motion := CheckBox.new()
	motion.text = "Reduced motion"
	motion.button_pressed = cfg.reduced_motion
	StoryUI.place(motion, self, Rect2(962, 674, 240, 30))
	motion.toggled.connect(func(v): app.preferences.reduced_motion = v; app.save_preferences())
	_filter_styles()

func _names() -> void:
	for i in range(name_fields.size()):
		name_fields[i].visible = i <= players.selected

func _fill(o: OptionButton, items: Array, preferred: String) -> void:
	o.clear()
	for item in items:
		o.add_item(str(item))
		if str(item) == preferred:
			o.select(o.item_count - 1)

func _filter_styles() -> void:
	var items: Array = []
	for deck in app.library.decks:
		if deck.domain == domain.text and deck.style not in items:
			items.append(deck.style)
	_fill(style, items, cfg.style)
	_filter_complexity()

func _filter_complexity() -> void:
	var items: Array = []
	for deck in app.library.decks:
		if deck.domain == domain.text and deck.style == style.text and deck.complexity not in items:
			items.append(deck.complexity)
	_fill(complexity, items, cfg.complexity)
	_filter_decks()

func _filter_decks() -> void:
	candidates.clear()
	deck_choice.clear()
	for deck in app.library.decks:
		if deck.domain == domain.text and deck.style == style.text and deck.complexity == complexity.text:
			candidates.append(deck)
			deck_choice.add_item(deck.title)
			if deck.id == cfg.deck_id:
				deck_choice.select(candidates.size() - 1)
	_sample()

func _sample() -> void:
	for child in sample_root.get_children():
		child.queue_free()
	if candidates.is_empty():
		return
	var deck: Dictionary = candidates[deck_choice.selected]
	pair_count.max_value = deck.images.size()
	pair_count.value = mini(int(pair_count.value), deck.images.size())
	StoryUI.label(sample_root, "Meet your matching companions", Rect2(768, 143, 418, 28), 23, StoryUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var back := StoryUI.texture(sample_root, load("res://assets/card_back.svg"), Rect2(798, 245, 190, 190))
	back.pivot_offset = Vector2(95, 95)
	back.rotation_degrees = -12
	StoryUI.panel(sample_root, Rect2(944, 273, 193, 193), Color("ddcde4"), 18)
	StoryUI.texture(sample_root, app.library.texture(deck.images[4 % deck.images.size()].image), Rect2(952, 281, 176, 176))
	StoryUI.panel(sample_root, Rect2(849, 209, 200, 200), Color("fff9f0"), 18)
	StoryUI.texture(sample_root, app.library.texture(deck.images[0].image), Rect2(857, 217, 184, 184))
	StoryUI.label(sample_root, deck.title, Rect2(766, 498, 420, 40), 29, StoryUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	StoryUI.label(sample_root, "%s artwork  /  %s" % [deck.style, deck.complexity.to_lower()], Rect2(764, 544, 424, 27), 17, StoryUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	StoryUI.label(sample_root, "%d unique companions to discover" % deck.images.size(), Rect2(764, 583, 424, 26), 17, StoryUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _config() -> Dictionary:
	var names: Array = []
	for i in range(4):
		var value := name_fields[i].text.strip_edges()
		names.append(value if not value.is_empty() else "Player %d" % (i + 1))
	return {"players": players.selected + 1, "names": names, "domain": domain.text, "style": style.text, "complexity": complexity.text, "deck_id": candidates[deck_choice.selected].id, "pairs": int(pair_count.value), "layout": layout_choice.text, "extra_turn": extra.button_pressed}

func _remember() -> void:
	for key in _config():
		app.preferences[key] = _config()[key]
	app.save_preferences()

func _library() -> void:
	_remember()
	app.show_library()

func _guide() -> void:
	_remember()
	app.show_guide()

func _start() -> void:
	app.start_round(_config(), candidates[deck_choice.selected])
