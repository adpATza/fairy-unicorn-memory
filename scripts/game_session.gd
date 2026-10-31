class_name MemorySession
extends RefCounted
## Pure round state. No timers or animations: tick is the only clock.
signal changed
signal pair_resolved(matched: bool, indices: Array)
signal completed

enum State { FIRST, SECOND, RESOLVING, FINISHED }
var state: State = State.FIRST
var cards: Array = []
var selections: Array[int] = []
var names: Array = []
var scores: Array[int] = []
var active_player: int = 0
var attempts: int = 0
var elapsed: float = 0.0
var remaining: int = 0
var resolution_left: float = 0.0
var extra_turn: bool = true
var paused: bool = false
var seed_value: int = 0

func start(entries: Array, pairs: int, players: Array, keep_turn: bool, round_seed: int) -> void:
	assert(pairs >= 2 and pairs <= 30 and pairs <= entries.size())
	assert(players.size() >= 1 and players.size() <= 4)
	state = State.FIRST
	cards.clear()
	selections.clear()
	names = players.duplicate()
	scores.clear()
	for _p in names:
		scores.append(0)
	active_player = 0
	attempts = 0
	elapsed = 0.0
	remaining = pairs
	resolution_left = 0.0
	extra_turn = keep_turn
	paused = false
	seed_value = round_seed
	var rng := RandomNumberGenerator.new()
	rng.seed = round_seed
	var pool: Array = entries.duplicate(true)
	_shuffle(pool, rng)
	for entry in pool.slice(0, pairs):
		for _copy in range(2):
			cards.append({"pair_id": entry.pair_id, "image": entry.image, "matched": false})
	_shuffle(cards, rng)
	changed.emit()

func _shuffle(items: Array, rng: RandomNumberGenerator) -> void:
	for i in range(items.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var temp = items[i]
		items[i] = items[j]
		items[j] = temp

func select(index: int) -> bool:
	if paused or state == State.RESOLVING or state == State.FINISHED:
		return false
	if index < 0 or index >= cards.size() or cards[index].matched or index in selections:
		return false
	selections.append(index)
	if state == State.FIRST:
		state = State.SECOND
	else:
		state = State.RESOLVING
		attempts += 1
		resolution_left = 0.65 if _is_match() else 1.5
	changed.emit()
	return true

func _is_match() -> bool:
	return selections.size() == 2 and cards[selections[0]].pair_id == cards[selections[1]].pair_id

func tick(delta: float) -> void:
	if paused or state == State.FINISHED:
		return
	var dt := maxf(delta, 0.0)
	elapsed += minf(dt, resolution_left) if state == State.RESOLVING and remaining == 1 and _is_match() else dt
	if state != State.RESOLVING:
		return
	resolution_left -= dt
	if resolution_left > 0.0:
		return
	var matched := _is_match()
	var resolved := selections.duplicate()
	if matched:
		scores[active_player] += 1
		remaining -= 1
		for index in selections:
			cards[index].matched = true
	if not matched or not extra_turn:
		active_player = (active_player + 1) % names.size()
	selections.clear()
	state = State.FINISHED if remaining == 0 else State.FIRST
	pair_resolved.emit(matched, resolved)
	changed.emit()
	if state == State.FINISHED:
		completed.emit()

func set_paused(value: bool) -> void:
	paused = value
	changed.emit()

func visible_card(index: int) -> bool:
	return not paused and index in selections

func winners() -> Array:
	var best: int = scores.max()
	var result: Array = []
	for i in range(names.size()):
		if scores[i] == best:
			result.append(names[i])
	return result
