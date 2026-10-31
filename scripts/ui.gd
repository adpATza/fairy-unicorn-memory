class_name StoryUI
extends RefCounted
const INK := Color("503957")
const MUTED := Color("817184")
const PLUM := Color("79558d")
const CREAM := Color("f8f3e9")
const LINE := Color("e5d9e5")

static func box(color: Color, radius: int = 12, border: Color = Color.TRANSPARENT, width: int = 0) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = color
	b.set_corner_radius_all(radius)
	b.border_color = border
	b.set_border_width_all(width)
	b.content_margin_left = 16
	b.content_margin_right = 16
	b.content_margin_top = 10
	b.content_margin_bottom = 10
	return b

static func theme() -> Theme:
	var t := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Segoe UI", "Noto Sans"])
	t.default_font = font
	t.default_font_size = 18
	for type in ["Label", "Button", "CheckButton", "CheckBox", "OptionButton", "LineEdit", "SpinBox"]:
		t.set_color("font_color", type, INK)
		t.set_color("font_hover_color", type, INK)
		t.set_color("font_focus_color", type, INK)
		t.set_color("font_pressed_color", type, INK)
		t.set_color("font_hover_pressed_color", type, INK)
	for type in ["CheckBox", "CheckButton"]:
		for state in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			t.set_stylebox(state, type, StyleBoxEmpty.new())
		t.set_stylebox("focus", type, box(Color.TRANSPARENT, 7, PLUM, 2))
	t.set_stylebox("normal", "Button", box(Color("eee5f2"), 10))
	t.set_stylebox("hover", "Button", box(Color("e4d6ec"), 10))
	t.set_stylebox("pressed", "Button", box(Color("d8c6e3"), 10))
	t.set_stylebox("focus", "Button", box(Color.TRANSPARENT, 10, Color("9b70ad"), 3))
	t.set_stylebox("disabled", "Button", box(Color("ece8e9"), 10))
	t.set_color("font_disabled_color", "Button", Color("9b929a"))
	for type in ["OptionButton", "LineEdit", "SpinBox"]:
		t.set_stylebox("normal", type, box(Color("fffaf3"), 9, LINE, 1))
		t.set_stylebox("hover", type, box(Color("f1e9f3"), 9, LINE, 1))
		t.set_stylebox("pressed", type, box(Color("e9ddef"), 9, LINE, 1))
		t.set_stylebox("focus", type, box(Color.TRANSPARENT, 9, PLUM, 3))
	t.set_stylebox("panel", "PopupMenu", box(Color("fffaf4"), 10, LINE, 1))
	t.set_color("font_color", "PopupMenu", INK)
	t.set_color("font_hover_color", "PopupMenu", INK)
	t.set_stylebox("hover", "PopupMenu", box(Color("e8dcf0"), 6))
	t.set_stylebox("panel", "AcceptDialog", box(CREAM, 18, LINE, 2))
	t.set_color("font_color", "RichTextLabel", INK)
	t.set_color("default_color", "RichTextLabel", INK)
	t.set_stylebox("panel", "TooltipPanel", box(Color("fffaf3"), 6, LINE, 1))
	t.set_color("font_color", "TooltipLabel", INK)
	t.set_font_size("font_size", "TooltipLabel", 15)
	return t

static func place(control: Control, parent: Node, rect: Rect2) -> Control:
	parent.add_child(control)
	control.position = rect.position
	control.size = rect.size
	return control

static func label(parent: Node, text_value: String, rect: Rect2, font_size: int = 18, color: Color = INK, serif: bool = false) -> Label:
	var l := Label.new()
	l.text = text_value
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	if serif:
		var font := SystemFont.new()
		font.font_names = PackedStringArray(["Georgia", "Noto Serif"])
		l.add_theme_font_override("font", font)
	place(l, parent, rect)
	return l

static func button(parent: Node, text_value: String, rect: Rect2, action: Callable, primary: bool = false) -> Button:
	var b := Button.new()
	b.text = text_value
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	if primary:
		b.add_theme_stylebox_override("normal", box(PLUM, 11))
		b.add_theme_stylebox_override("hover", box(Color("9169a5"), 11))
		b.add_theme_stylebox_override("pressed", box(Color("674679"), 11))
		for color in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			b.add_theme_color_override(color, Color("fff9f0"))
	b.pressed.connect(action)
	place(b, parent, rect)
	return b

static func option(parent: Node, items: Array, selected: String, rect: Rect2) -> OptionButton:
	var o := OptionButton.new()
	for item in items:
		o.add_item(str(item))
		if str(item) == selected:
			o.select(o.item_count - 1)
	place(o, parent, rect)
	return o

static func line(parent: Node, text_value: String, rect: Rect2, placeholder: String = "") -> LineEdit:
	var l := LineEdit.new()
	l.text = text_value
	l.placeholder_text = placeholder
	l.max_length = 40
	place(l, parent, rect)
	return l

static func texture(parent: Node, tex: Texture2D, rect: Rect2) -> TextureRect:
	var t := TextureRect.new()
	t.texture = tex
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	place(t, parent, rect)
	return t

static func panel(parent: Node, rect: Rect2, color: Color = Color("fffaf3"), radius: int = 18) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", box(color, radius))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	place(p, parent, rect)
	return p
