extends Control
var app

func _ready() -> void:
	StoryUI.label(self, "A grown-up’s guide to little worlds", Rect2(42, 28, 970, 64), 40, StoryUI.INK, true)
	StoryUI.button(self, "Return to setup", Rect2(1026, 40, 213, 43), app.show_setup)
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	text.text = FileAccess.get_file_as_string("res://docs/adult-guide.txt")
	text.add_theme_font_size_override("normal_font_size", 20)
	text.add_theme_constant_override("line_separation", 7)
	text.selection_enabled = true
	StoryUI.place(text, self, Rect2(58, 119, 1164, 520))
	StoryUI.button(self, "Open offline HTML guide", Rect2(46, 663, 340, 40), func():
		var path := "user://Artwork and Import Guide.html"
		var file := FileAccess.open(path, FileAccess.WRITE)
		if file:
			file.store_string(FileAccess.get_file_as_string("res://docs/Artwork and Import Guide.html"))
			file.close()
			OS.shell_open(ProjectSettings.globalize_path(path)))
	StoryUI.button(self, "Go to deck library", Rect2(924, 663, 315, 40), app.show_library)
