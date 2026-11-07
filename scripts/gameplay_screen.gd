extends Control
const CARD := preload("res://scenes/card.tscn")
var app
var config: Dictionary
var deck: Dictionary
var session := MemorySession.new()
var card_nodes: Array = []
var rects: Array[Rect2] = []
var score_labels: Array[Label] = []
var score_names: Array[Label] = []
var turn_label: Label
var time_label: Label
var remaining_label: Label
var hint: Label
var pause_layer: Control
var sound_button: Button
var resume_button: Button
var was_focused: Control

func _ready() -> void:
	var round_seed := int(Time.get_ticks_usec()) ^ int(Crypto.new().generate_random_bytes(4).decode_u32(0))
	session.start(deck.images, config.pairs, config.names.slice(0, config.players), config.extra_turn, round_seed)
	rects = MemoryLayout.generate(session.cards.size(), config.layout == "Scattered", round_seed)
	GameUI.label(self, "Memory Card Game", Rect2(34, 13, 650, 45), 30, GameUI.INK, true)
	GameUI.label(self, "%s  /  %s  /  %s" % [deck.title, deck.complexity, config.layout], Rect2(36, 61, 735, 25), 16, GameUI.MUTED)
	GameUI.button(self, "Pause", Rect2(958, 23, 122, 43), func(): set_paused(true))
	sound_button = GameUI.button(self, "Sound on" if app.preferences.sound else "Sound off", Rect2(1092, 23, 154, 43), _toggle_sound)
	turn_label = GameUI.label(self, "", Rect2(37, 103, 350, 30), 22, GameUI.INK, true)
	turn_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	remaining_label = GameUI.label(self, "", Rect2(977, 105, 270, 26), 18, GameUI.MUTED)
	remaining_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	for i in range(config.players):
		var name_label := GameUI.label(self, str(session.names[i]), Rect2(382 + i * 147, 94, 137, 22), 15)
		name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		name_label.tooltip_text = str(session.names[i])
		score_names.append(name_label)
		var l := GameUI.label(self, "", Rect2(382 + i * 147, 117, 137, 23), 17)
		score_labels.append(l)
	for i in range(session.cards.size()):
		var card = CARD.instantiate()
		card.index = i
		card.artwork = app.library.texture(session.cards[i].image)
		GameUI.place(card, self, rects[i])
		card.pressed.connect(func():
			if session.select(i):
				app.play_sound("flip"))
		card_nodes.append(card)
	GameUI.button(self, "Setup", Rect2(34, 665, 108, 37), func(): request_leave(app.show_setup))
	GameUI.button(self, "New round", Rect2(154, 665, 144, 37), func(): request_leave(func(): app.start_round(config, deck), "Start a new round?", "Your current round will be lost. The new round has a fresh shuffle.", "New round"))
	hint = GameUI.label(self, "Choose two cards and find a pair.", Rect2(326, 670, 620, 25), 17, GameUI.MUTED)
	time_label = GameUI.label(self, "", Rect2(971, 669, 275, 28), 17, GameUI.MUTED)
	time_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_build_pause()
	session.changed.connect(_refresh)
	session.pair_resolved.connect(_resolved)
	session.completed.connect(_finished)
	_refresh()
	card_nodes[0].grab_focus()

func _process(delta: float) -> void:
	session.tick(delta)
	if is_instance_valid(time_label):
		time_label.text = "%d attempts   %s" % [session.attempts, app.format_time(session.elapsed)]

func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		set_paused(not session.paused)
		get_viewport().set_input_as_handled()
	elif not session.paused and event is InputEventKey and event.pressed and event.keycode in [KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN]:
		_move_focus(event.keycode)
		get_viewport().set_input_as_handled()

func _move_focus(key: Key) -> void:
	var focused := get_viewport().gui_get_focus_owner()
	var current := card_nodes.find(focused)
	if current < 0:
		for card in card_nodes:
			if card.visible:
				card.grab_focus()
				return
		return
	var origin := rects[current].get_center()
	var direction := Vector2.LEFT if key == KEY_LEFT else (Vector2.RIGHT if key == KEY_RIGHT else (Vector2.UP if key == KEY_UP else Vector2.DOWN))
	var best := -1
	var best_cost := INF
	for i in range(card_nodes.size()):
		if i == current or not card_nodes[i].visible:
			continue
		var offset := rects[i].get_center() - origin
		var forward := offset.dot(direction)
		if forward <= 1:
			continue
		var lateral := absf(offset.cross(direction))
		var cost := forward + lateral * 3.0
		if cost < best_cost:
			best_cost = cost
			best = i
	if best >= 0:
		card_nodes[best].grab_focus()

func _refresh() -> void:
	turn_label.text = "%s’s turn" % session.names[session.active_player] if config.players > 1 else "Take your time. Find a pair."
	remaining_label.text = "%d %s left" % [session.remaining, "pair" if session.remaining == 1 else "pairs"]
	for i in range(score_labels.size()):
		score_labels[i].text = "%d %s" % [session.scores[i], "pair" if session.scores[i] == 1 else "pairs"]
		score_labels[i].add_theme_color_override("font_color", GameUI.ACCENT if i == session.active_player else GameUI.MUTED)
		score_names[i].add_theme_color_override("font_color", GameUI.ACCENT if i == session.active_player else GameUI.MUTED)
	for i in range(card_nodes.size()):
		card_nodes[i].update_face(session.visible_card(i), session.cards[i].matched, app.preferences.reduced_motion or session.paused)
	if session.state == MemorySession.State.SECOND:
		hint.text = "Now choose a second card."
	elif session.state == MemorySession.State.RESOLVING:
		hint.text = "Match! Nice work." if session.cards[session.selections[0]].pair_id == session.cards[session.selections[1]].pair_id else "Take a moment to remember these two."
	else:
		hint.text = "Choose two cards and find a pair."

func _resolved(matched: bool, indices: Array) -> void:
	app.play_sound("match" if matched else "miss")
	if matched and card_nodes[indices[1]].has_focus():
		for i in range(card_nodes.size()):
			if not session.cards[i].matched:
				card_nodes[i].grab_focus()
				break

func _finished() -> void:
	_deliver_results.call_deferred()

func _deliver_results() -> void:
	# A restart/leave in the same frame invalidates this screen's queued result.
	if not is_inside_tree() or app.game != self:
		return
	app.show_results({"names": session.names, "scores": session.scores, "winners": session.winners(), "attempts": session.attempts, "elapsed": session.elapsed, "config": config, "deck": deck})

func _toggle_sound() -> void:
	app.preferences.sound = not app.preferences.sound
	app.save_preferences()
	sound_button.text = "Sound on" if app.preferences.sound else "Sound off"

func _build_pause() -> void:
	pause_layer = Control.new()
	GameUI.place(pause_layer, self, Rect2(0, 0, 1280, 720))
	pause_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	var veil := ColorRect.new()
	veil.color = Color(0.949, 0.969, 0.996, 0.98)
	GameUI.place(veil, pause_layer, Rect2(0, 0, 1280, 720))
	GameUI.panel(pause_layer, Rect2(381, 177, 518, 385), Color.WHITE, 28)
	GameUI.label(pause_layer, "Time out!", Rect2(421, 211, 438, 60), 42, GameUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	GameUI.label(pause_layer, "Cards hidden. Clock stopped.\nReady when you are.", Rect2(421, 282, 438, 60), 20, GameUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	resume_button = GameUI.button(pause_layer, "Continue playing", Rect2(479, 370, 322, 52), func(): set_paused(false), true)
	var motion := CheckBox.new()
	motion.text = "Reduced motion"
	motion.button_pressed = app.preferences.reduced_motion
	GameUI.place(motion, pause_layer, Rect2(528, 442, 240, 37))
	motion.toggled.connect(func(v): app.preferences.reduced_motion = v; app.save_preferences())
	GameUI.button(pause_layer, "Return to setup", Rect2(505, 492, 270, 41), func(): request_leave(app.show_setup))
	pause_layer.hide()

func set_paused(value: bool) -> void:
	if session.state == MemorySession.State.FINISHED or not is_instance_valid(pause_layer):
		return
	if value and not session.paused:
		was_focused = get_viewport().gui_get_focus_owner()
	session.set_paused(value)
	pause_layer.visible = value
	for child in get_children():
		if child is BaseButton:
			child.focus_mode = Control.FOCUS_NONE if value else Control.FOCUS_ALL
	if value:
		resume_button.grab_focus()
	elif is_instance_valid(was_focused) and was_focused.visible:
		was_focused.grab_focus()

func request_leave(action: Callable, title_text: String = "Leave this round?", detail: String = "Your current round will be lost. Your decks and settings are saved.", accept_text: String = "Leave game") -> void:
	var was_paused := session.paused
	set_paused(true)
	app.confirm_action(title_text, detail, action, func(): set_paused(was_paused), accept_text)
