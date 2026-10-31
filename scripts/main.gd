extends Control
var library := MemoryDeckLibrary.new()
var preferences := {"players": 1, "names": ["Player 1", "Player 2", "Player 3", "Player 4"], "domain": "Fairies", "style": "Illustrated", "complexity": "Easy", "deck_id": "fairies_easy", "pairs": 12, "layout": "Scattered", "extra_turn": true, "sound": true, "reduced_motion": false}
var screen: Control
var game: Control
var audio: AudioStreamPlayer
var tone_flip: AudioStreamWAV
var tone_match: AudioStreamWAV
var tone_miss: AudioStreamWAV

func _ready() -> void:
	theme = StoryUI.theme()
	get_tree().auto_accept_quit = false
	library.discover()
	load_preferences()
	audio = AudioStreamPlayer.new()
	add_child(audio)
	tone_flip = _tone([440.0], 0.055, 0.09)
	tone_match = _tone([523.25, 659.25, 783.99], 0.28, 0.10)
	tone_miss = _tone([293.66], 0.12, 0.07)
	if "--self-test" in OS.get_cmdline_user_args() or "--persistence-check" in OS.get_cmdline_user_args():
		var runner = load("res://tests/test_runner.gd").new()
		add_child(runner)
		runner.run.call_deferred(self)
		return
	show_setup()

func _tone(notes: Array, duration: float, volume: float) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	var rate := 22050
	for i in range(int(rate * duration)):
		var t := float(i) / rate
		var value := 0.0
		for hz in notes:
			value += sin(TAU * float(hz) * t)
		value *= volume / notes.size() * sin(PI * t / duration) * exp(-5.0 * t)
		var sample := int(value * 32767.0)
		bytes.append(sample & 255)
		bytes.append((sample >> 8) & 255)
	var wave := AudioStreamWAV.new()
	wave.format = AudioStreamWAV.FORMAT_16_BITS
	wave.mix_rate = rate
	wave.data = bytes
	return wave

func play_sound(kind: String) -> void:
	if not preferences.sound:
		return
	audio.stream = tone_match if kind == "match" else (tone_miss if kind == "miss" else tone_flip)
	audio.play()

func _replace(next: Control) -> void:
	if is_instance_valid(screen):
		remove_child(screen)
		screen.queue_free()
	screen = next
	next.set("app", self)
	add_child(next)
	next.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func show_setup() -> void:
	game = null
	_replace(load("res://scenes/setup.tscn").instantiate())

func show_library() -> void:
	_replace(load("res://scenes/library.tscn").instantiate())

func show_guide() -> void:
	_replace(load("res://scenes/guide.tscn").instantiate())

func start_round(config: Dictionary, deck: Dictionary) -> void:
	for key in config:
		preferences[key] = config[key]
	save_preferences()
	var next = load("res://scenes/gameplay.tscn").instantiate()
	next.config = config.duplicate(true)
	next.deck = deck
	game = next
	_replace(next)

func show_results(result: Dictionary) -> void:
	game = null
	var next = load("res://scenes/results.tscn").instantiate()
	next.result = result
	_replace(next)

func save_preferences() -> void:
	var cfg := ConfigFile.new()
	for key in preferences:
		cfg.set_value("settings", key, preferences[key])
	cfg.save("user://preferences.cfg")

func load_preferences() -> void:
	var cfg := ConfigFile.new()
	if cfg.load("user://preferences.cfg") != OK:
		return
	for key in preferences:
		var value = cfg.get_value("settings", key, preferences[key])
		if typeof(value) == typeof(preferences[key]):
			preferences[key] = value
	preferences.players = clampi(preferences.players, 1, 4)
	preferences.pairs = clampi(preferences.pairs, 2, 30)
	if preferences.names.size() != 4:
		preferences.names = ["Player 1", "Player 2", "Player 3", "Player 4"]

func confirm_action(title_text: String, detail: String, action: Callable, cancelled: Callable = Callable(), accept_text: String = "Leave game") -> void:
	var dialog := ConfirmationDialog.new()
	dialog.title = title_text
	dialog.dialog_text = detail
	dialog.ok_button_text = accept_text
	dialog.cancel_button_text = "Cancel"
	dialog.min_size = Vector2i(510, 160)
	add_child(dialog)
	dialog.confirmed.connect(func():
		action.call()
		dialog.queue_free())
	dialog.canceled.connect(func():
		if cancelled.is_valid():
			cancelled.call()
		dialog.queue_free())
	dialog.popup_centered()

func notice(message: String) -> void:
	var dialog := AcceptDialog.new()
	dialog.title = "Deck library"
	dialog.dialog_text = message
	add_child(dialog)
	dialog.confirmed.connect(dialog.queue_free)
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered(Vector2i(540, 180))

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if is_instance_valid(game) and game.session.state != MemorySession.State.FINISHED:
			game.request_leave(func(): get_tree().quit())
		else:
			get_tree().quit()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if is_instance_valid(game):
			game.set_paused(true)

static func format_time(seconds: float) -> String:
	var total := int(seconds)
	return "%02d:%02d" % [total / 60, total % 60]
