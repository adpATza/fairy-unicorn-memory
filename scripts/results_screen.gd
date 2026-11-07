extends Control
var app
var result: Dictionary

func _ready() -> void:
	GameUI.label(self, "Every pair found", Rect2(80, 60, 1120, 70), 56, GameUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	GameUI.label(self, "Sharp eyes. Great game!", Rect2(80, 145, 1120, 32), 22, GameUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	GameUI.panel(self, Rect2(339, 214, 602, 344), Color.WHITE, 28)
	if result.names.size() == 1:
		GameUI.label(self, "You matched them all!", Rect2(369, 243, 542, 50), 31, GameUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		GameUI.label(self, "%s" % app.format_time(result.elapsed), Rect2(369, 306, 542, 75), 63, GameUI.ACCENT, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		GameUI.label(self, "%d pairs found in %d attempts" % [result.scores[0], result.attempts], Rect2(369, 404, 542, 34), 23).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		GameUI.label(self, "New shuffle. New challenge. Ready?", Rect2(369, 479, 542, 30), 17, GameUI.MUTED).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	else:
		var title := "We have a winner!" if result.winners.size() == 1 else "It’s a tie!"
		GameUI.label(self, title, Rect2(369, 238, 542, 51), 36, GameUI.INK, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		GameUI.label(self, "Winning players are marked with a star.", Rect2(369, 294, 542, 31), 19, GameUI.ACCENT).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		for i in range(result.names.size()):
			var y: int = 338 + i * 43
			if result.scores[i] == result.scores.max():
				GameUI.label(self, "★", Rect2(378, y, 27, 30), 20, GameUI.ACCENT)
			var name_label := GameUI.label(self, str(result.names[i]), Rect2(409, y, 350, 30), 18)
			name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			name_label.tooltip_text = str(result.names[i])
			GameUI.label(self, "%d %s" % [result.scores[i], "pair" if result.scores[i] == 1 else "pairs"], Rect2(779, y, 130, 30), 22, GameUI.ACCENT)
	GameUI.button(self, "Play again", Rect2(375, 599, 250, 56), func(): app.start_round(result.config, result.deck), true).grab_focus()
	GameUI.button(self, "Return to setup", Rect2(655, 599, 250, 56), app.show_setup)
