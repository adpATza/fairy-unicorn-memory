class_name MemoryCard
extends Button
var index: int = 0
var artwork: Texture2D
var revealed: bool = false
var reduced_motion: bool = false
var back: Texture2D = preload("res://assets/card_back.svg")
var last_revealed: bool = false
var flip: Tween

func _ready() -> void:
	text = ""
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for key in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(key, StyleBoxEmpty.new())
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	focus_entered.connect(queue_redraw)
	focus_exited.connect(queue_redraw)
	tooltip_text = "Face-down card %d" % (index + 1)
	set_meta("neutral_label", tooltip_text)

func update_face(show_art: bool, removed: bool, motion_reduced: bool) -> void:
	reduced_motion = motion_reduced
	visible = not removed
	disabled = removed
	if flip and flip.is_valid():
		flip.kill()
	scale = Vector2.ONE
	revealed = show_art
	tooltip_text = ("Revealed card %d" if revealed else "Face-down card %d") % (index + 1)
	if revealed != last_revealed and visible and not motion_reduced:
		pivot_offset = size * 0.5
		scale = Vector2(0.88, 1.0)
		flip = create_tween()
		flip.tween_property(self, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_SINE)
	last_revealed = revealed
	queue_redraw()

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	draw_style_box(StoryUI.box(Color(0.31, 0.20, 0.35, 0.10), 13), Rect2(rect.position + Vector2(0, 4), rect.size))
	if revealed:
		draw_style_box(StoryUI.box(Color("fff9f0"), 12, Color("c7afd1"), 2), rect)
		if artwork:
			draw_texture_rect(artwork, rect.grow(-6), false)
	else:
		draw_texture_rect(back, rect, false)
	if is_hovered() or has_focus():
		draw_style_box(StoryUI.box(Color.TRANSPARENT, 14, Color("77518b"), 3), rect.grow(3))
