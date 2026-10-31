extends Control
var app
var result: Dictionary

func _ready() -> void:
	StoryUI.label(self, "Every pair found", Rect2(80, 60, 1120, 70), 56, StoryUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	StoryUI.label(self, "A little world, remembered beautifully.", Rect2(80, 145, 1120, 32), 22, StoryUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	StoryUI.panel(self, Rect2(339, 214, 602, 344), Color("eee5f2"), 34)
	if result.names.size() == 1:
		StoryUI.label(self, "Lovely matching!", Rect2(369, 243, 542, 50), 31, StoryUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		StoryUI.label(self, "%s" % app.format_time(result.elapsed), Rect2(369, 306, 542, 75), 63, StoryUI.PLUM, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		StoryUI.label(self, "%d pairs found in %d attempts" % [result.scores[0], result.attempts], Rect2(369, 404, 542, 34), 23).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		StoryUI.label(self, "There’s always time for another little adventure.", Rect2(369, 479, 542, 30), 17, StoryUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	else:
		var title := "A lovely victory!" if result.winners.size() == 1 else "A shared victory!"
		StoryUI.label(self, title, Rect2(369, 238, 542, 51), 36, StoryUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		StoryUI.label(self, "Winning players are marked with a star.", Rect2(369, 294, 542, 31), 19, StoryUI.PLUM).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		for i in range(result.names.size()):
			var y: int = 338 + i * 43
			if result.scores[i] == result.scores.max():
				StoryUI.label(self, "★", Rect2(378, y, 27, 30), 20, StoryUI.PLUM)
			var name_label := StoryUI.label(self, str(result.names[i]), Rect2(409, y, 350, 30), 18)
			name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			name_label.tooltip_text = str(result.names[i])
			StoryUI.label(self, "%d %s" % [result.scores[i], "pair" if result.scores[i] == 1 else "pairs"], Rect2(779, y, 130, 30), 22, StoryUI.PLUM)
	StoryUI.button(self, "Play again", Rect2(375, 599, 250, 56), func(): app.start_round(result.config, result.deck), true).grab_focus()
	StoryUI.button(self, "Return to setup", Rect2(655, 599, 250, 56), app.show_setup)
