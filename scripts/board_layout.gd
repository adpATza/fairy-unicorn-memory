class_name MemoryLayout
extends RefCounted
## All coordinates are in a fixed 1280 x 720 canvas. Godot letterboxes it.
const AREA := Rect2(34, 154, 1212, 490)
const GAP := 10.0

static func generate(count: int, scattered: bool, layout_seed: int) -> Array[Rect2]:
	assert(count >= 4 and count <= 60)
	var rng := RandomNumberGenerator.new()
	rng.seed = layout_seed ^ 0x3F2A9C17
	if not scattered:
		return _grid(count)
	var side := minf(184.0, sqrt(AREA.get_area() / float(count)) * 0.78 - GAP * 0.5)
	# Sparse boards use unstructured dart throwing directly. Keep dense cards
	# readable instead of shrinking them indefinitely when random packing jams.
	if count <= 40:
		var trial_side := side
		for _trial in range(7):
			var darts: Array[Rect2] = []
			for _i in range(count):
				var placed := false
				for _attempt in range(240):
					var candidate := Rect2(Vector2(rng.randf_range(AREA.position.x, AREA.end.x - trial_side), rng.randf_range(AREA.position.y, AREA.end.y - trial_side)), Vector2.ONE * trial_side)
					var clear := true
					for rect in darts:
						if candidate.grow(GAP * 0.5).intersects(rect.grow(GAP * 0.5)):
							clear = false
							break
					if clear:
						darts.append(candidate)
						placed = true
						break
				if not placed:
					break
			if darts.size() == count:
				return darts
			trial_side = maxf(74.0, trial_side * 0.94)
	# Random binary free-space subdivision avoids dart-throwing's tiny-card jam.
	# Leaves have different dimensions and independently randomized positions:
	# there are no rows, columns, snapped coordinates, or visible rotations.
	for _pass in range(24):
		var slot := side + GAP + 0.01
		if floori(AREA.size.x / slot) * floori(AREA.size.y / slot) >= count:
			var cells: Array[Rect2] = []
			_scatter_cells(AREA, count, slot, rng, cells)
			var positions: Array[Rect2] = []
			for cell in cells:
				var candidate := Rect2(Vector2(rng.randf_range(cell.position.x + GAP * 0.5, cell.end.x - side - GAP * 0.5), rng.randf_range(cell.position.y + GAP * 0.5, cell.end.y - side - GAP * 0.5)), Vector2.ONE * side)
				var clear := AREA.encloses(candidate)
				for rect in positions:
					if candidate.grow(GAP * 0.499).intersects(rect.grow(GAP * 0.499)):
						clear = false
						break
				if not clear:
					break
				positions.append(candidate)
			if positions.size() == count:
				_mix_positions(positions, side, rng)
				return positions
		side *= 0.96
	push_error("Scattered placement exhausted its bounded retries")
	return []

static func _mix_positions(positions: Array[Rect2], side: float, rng: RandomNumberGenerator) -> void:
	# Free-space random walks remove the bands a capacity-conscious subdivision
	# can leave. All movement happens inside generation, before any card is shown.
	for sweep in range(48):
		for i in range(positions.size()):
			var candidate := positions[i]
			if sweep % 12 == 0:
				candidate.position = Vector2(rng.randf_range(AREA.position.x, AREA.end.x - side), rng.randf_range(AREA.position.y, AREA.end.y - side))
			else:
				candidate.position += Vector2(rng.randf_range(-side * 0.7, side * 0.7), rng.randf_range(-side * 0.7, side * 0.7))
			if not AREA.encloses(candidate):
				continue
			var clear := true
			for j in range(positions.size()):
				if j != i and candidate.grow(GAP * 0.499).intersects(positions[j].grow(GAP * 0.499)):
					clear = false
					break
			if clear:
				positions[i] = candidate

static func _scatter_cells(area: Rect2, count: int, slot: float, rng: RandomNumberGenerator, output: Array[Rect2]) -> void:
	if count == 1:
		output.append(area)
		return
	var columns := floori(area.size.x / slot)
	var rows := floori(area.size.y / slot)
	var vertical := columns > 1 and (rows < 2 or rng.randf() < area.size.x / (area.size.x + area.size.y))
	var capacity_axis := columns if vertical else rows
	var across := rows if vertical else columns
	var split_slots := rng.randi_range(1, capacity_axis - 1)
	var extent := area.size.x if vertical else area.size.y
	var cut := rng.randf_range(split_slots * slot, extent - (capacity_axis - split_slots) * slot)
	var left_capacity := split_slots * across
	var right_capacity := (capacity_axis - split_slots) * across
	var desired := roundi(count * cut / extent)
	var left_count := clampi(desired, maxi(1, count - right_capacity), mini(count - 1, left_capacity))
	var left := area
	var right := area
	if vertical:
		left.size.x = cut
		right.position.x += cut
		right.size.x -= cut
	else:
		left.size.y = cut
		right.position.y += cut
		right.size.y -= cut
	_scatter_cells(left, left_count, slot, rng, output)
	_scatter_cells(right, count - left_count, slot, rng, output)

static func _grid(count: int) -> Array[Rect2]:
	var usable := AREA.grow(-1.0)
	var columns := ceili(sqrt(float(count) * AREA.size.x / AREA.size.y))
	var rows := ceili(float(count) / columns)
	var side := minf(184.0, minf((usable.size.x - GAP * (columns - 1)) / columns, (usable.size.y - GAP * (rows - 1)) / rows))
	var origin := usable.position + (usable.size - Vector2(columns * side + (columns - 1) * GAP, rows * side + (rows - 1) * GAP)) * 0.5
	var result: Array[Rect2] = []
	for i in range(count):
		result.append(Rect2(origin + Vector2(i % columns, i / columns) * (side + GAP), Vector2.ONE * side))
	return result

static func canvas_transform(window_size: Vector2) -> Transform2D:
	var factor := minf(window_size.x / 1280.0, window_size.y / 720.0)
	return Transform2D(0.0, Vector2.ONE * factor, 0.0, (window_size - Vector2(1280, 720) * factor) * 0.5)
