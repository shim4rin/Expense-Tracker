// State
const state = {
	currentView: 'home',
	currentStep: 1,
	session: null,
	tasks: [],
	selectedTaskIds: [],
	timer: { running: false, start: 0, elapsedMs: 0 },
};

// Utilities
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function saveLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadLocal(key, fallback) {
	try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// Navigation
function setView(viewId) {
	state.currentView = viewId;
	$$('.view').forEach(v => v.classList.remove('active'));
	$(`#view-${viewId}`).classList.add('active');
	$$('.tab-btn').forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.view === viewId)));
	if (viewId === 'export') {
		renderExportTable();
	}
}

function setStep(step) {
	state.currentStep = step;
	$$('.window').forEach(w => w.classList.remove('active'));
	$(`#window-${step}`).classList.add('active');
	$$('.step').forEach(s => s.classList.toggle('active', Number(s.dataset.step) === step));
}

// Session
function createEmptySession() {
	return {
		general: { roundNumber: '', venueSeat: '', teamNumber: '', teamName: '', group: '' },
		selectedTaskIds: [],
		scoring: { objectives: {}, departureBonus: 0, restartBonus: 0, restartCount: 0, total: 0, elapsedSec: 0 },
		final: { referee: '', scorer: '', teamMembers: '', remarks: '' },
		createdAt: Date.now(),
	};
}

function loadInitialData() {
	state.tasks = loadLocal('wer_tasks', [
		{ id: uid(), name: 'Sample Task A', objectives: [ { id: uid(), name: 'Objective 1', points: 10 }, { id: uid(), name: 'Objective 2', points: 20 } ] },
		{ id: uid(), name: 'Sample Task B', objectives: [ { id: uid(), name: 'Reach Zone', points: 15 } ] },
	]);
	state.session = loadLocal('wer_current_session', null);
}

function persistSession() { saveLocal('wer_current_session', state.session); }
function persistTasks() { saveLocal('wer_tasks', state.tasks); }

// Home actions
function handleNewRound() {
	state.session = createEmptySession();
	persistSession();
	setView('scoring');
	setStep(1);
	fillGeneralForm();
}

// removed continue-last-session per request

// General Info
function fillGeneralForm() {
	const { general } = state.session;
	$('#roundNumber').value = general.roundNumber;
	$('#venueSeat').value = general.venueSeat;
	$('#teamNumber').value = general.teamNumber;
	$('#teamName').value = general.teamName;
	$('#group').value = general.group;
}

function handleGeneralSubmit(e) {
	e.preventDefault();
	const roundNumber = Number($('#roundNumber').value);
	const teamName = $('#teamName').value.trim();
	if (!roundNumber || !teamName) { alert('Please fill required fields: Round Number and Team Name.'); return; }
	state.session.general = {
		roundNumber,
		venueSeat: $('#venueSeat').value.trim(),
		teamNumber: $('#teamNumber').value.trim(),
		teamName,
		group: $('#group').value.trim(),
	};
	persistSession();
	setStep(2);
	renderTaskSelection();
}

// Tasks CRUD
function renderTaskSelection() {
	const list = $('#task-list');
	list.innerHTML = '';
	const selected = new Set(state.session.selectedTaskIds);
	state.tasks.forEach(task => {
		const card = document.createElement('div');
		card.className = 'task-card';
		card.innerHTML = `
			<div class="task-header">
				<strong>${task.name}</strong>
				<div>
					<button class="btn" data-edit>Edit</button>
					<label style="margin-left:8px"><input type="checkbox" data-select ${selected.has(task.id) ? 'checked' : ''}/> Select</label>
				</div>
			</div>
			<div class="task-objectives muted">${task.objectives.map(o => `${o.name} (+${o.points})`).join(', ') || 'No objectives'}</div>
		`;
		card.querySelector('[data-edit]').addEventListener('click', () => openTaskEditor(task));
		card.querySelector('[data-select]').addEventListener('change', (ev) => toggleTaskSelect(task.id, ev.target.checked));
		list.appendChild(card);
	});
	updateTaskCount();
}

function updateTaskCount() {
	const count = state.session.selectedTaskIds.length;
	$('#task-count').textContent = `${count} / 7 selected`;
}

function toggleTaskSelect(taskId, checked) {
	const ids = new Set(state.session.selectedTaskIds);
	if (checked) {
		if (ids.size >= 7) { alert('You can select up to 7 tasks.'); renderTaskSelection(); return; }
		ids.add(taskId);
	} else { ids.delete(taskId); }
	state.session.selectedTaskIds = Array.from(ids);
	persistSession();
	updateTaskCount();
}

function openTaskEditor(task) {
	const isNew = !task;
	const working = isNew ? { id: uid(), name: '', objectives: [] } : JSON.parse(JSON.stringify(task));
	showModal('Edit Task', buildTaskEditorBody(working), () => {
		const name = $('#editTaskName').value.trim();
		if (!name) { alert('Task name required'); return false; }
		working.name = name;
		working.objectives = $$('[data-obj-row]').map(row => {
			const objName = $('input[data-obj-name]', row).value.trim();
			const points = Number($('input[data-obj-points]', row).value) || 0;
			if (!objName) return null;
			return { id: $('input[data-obj-id]', row).value || uid(), name: objName, points };
		}).filter(Boolean);
		if (isNew) { state.tasks.push(working); }
		else {
			const idx = state.tasks.findIndex(t => t.id === working.id);
			if (idx >= 0) state.tasks[idx] = working;
		}
		persistTasks();
		renderTaskSelection();
		return true;
	}, true, () => {
		// on open attach handlers
		$('#addObjectiveRow').addEventListener('click', () => addObjectiveRow());
		$$('.removeObjectiveRow').forEach(btn => btn.addEventListener('click', (e) => { e.currentTarget.closest('[data-obj-row]').remove(); }));
	});
}

function buildTaskEditorBody(task) {
	const rows = task.objectives.map(obj => objectiveRowHtml(obj)).join('');
	return `
		<div class="stack gap">
			<div class="field">
				<label>Task Name</label>
				<input id="editTaskName" type="text" value="${escapeHtml(task.name)}" />
			</div>
			<div class="stack gap" id="objectiveRows">
				${rows || objectiveRowHtml()}
			</div>
			<button id="addObjectiveRow" class="btn">Add Objective</button>
		</div>
	`;
}

function objectiveRowHtml(obj = { id: '', name: '', points: 0 }) {
    const pointsValue = obj && obj.id ? obj.points : '';
    return `
        <div class="grid-2 gap" data-obj-row>
            <input type="hidden" data-obj-id value="${obj.id}">
            <input data-obj-name type="text" placeholder="Objective name" value="${escapeHtml(obj.name)}" />
            <input data-obj-points type="number" placeholder="points" value="${pointsValue}" />
            <button type="button" class="btn removeObjectiveRow" onclick="this.closest('[data-obj-row]').remove()">Remove</button>
        </div>
    `;
}

function addObjectiveRow() {
	$('#objectiveRows').insertAdjacentHTML('beforeend', objectiveRowHtml());
}

// Confirmation before scoring
function openTaskConfirmation() {
	const chosen = state.tasks.filter(t => state.session.selectedTaskIds.includes(t.id));
	if (chosen.length === 0) { alert('Select at least one task.'); return; }
	const body = document.createElement('div');
	body.className = 'stack gap';
	chosen.forEach(task => {
		const div = document.createElement('div');
		div.innerHTML = `<strong>${escapeHtml(task.name)}</strong><div class="muted">${task.objectives.map(o => `${escapeHtml(o.name)} (+${o.points})`).join(', ') || 'No objectives'}</div>`;
		body.appendChild(div);
	});
	showModal('Are you sure?', body, () => { setStep(3); renderScoring(); return true; });
}

// Scoring
function renderScoring() {
	const container = $('#scoring-tasks');
	container.innerHTML = '';
	const chosen = state.tasks.filter(t => state.session.selectedTaskIds.includes(t.id));
	chosen.forEach(task => {
		const card = document.createElement('div');
		card.className = 'task-card';
		const itemsHtml = task.objectives.map(obj => {
			const key = `${task.id}:${obj.id}`;
			const checked = Boolean(state.session.scoring.objectives[key]);
			return `<div class="objective">
				<input type="checkbox" data-obj-key="${key}" ${checked ? 'checked' : ''} />
				<div>${escapeHtml(obj.name)}</div>
				<div class="muted">+${obj.points}</div>
			</div>`;
		}).join('');
		card.innerHTML = `<div class="task-header"><strong>${escapeHtml(task.name)}</strong></div><div class="task-objectives">${itemsHtml || '<div class="muted">No objectives</div>'}</div>`;
		container.appendChild(card);
	});
	$('#departureBonus').value = state.session.scoring.departureBonus || 0;
	$('#restartBonus').value = state.session.scoring.restartBonus || 0;
	$('#restartCount').textContent = String(state.session.scoring.restartCount || 0);
	updateTotals();
	$$('input[data-obj-key]').forEach(cb => cb.addEventListener('change', onObjectiveToggle));
}

function onObjectiveToggle(e) {
	const key = e.target.getAttribute('data-obj-key');
	state.session.scoring.objectives[key] = e.target.checked;
	persistSession();
	updateTotals();
}

function applyDeparture() {
	state.session.scoring.departureBonus = Number($('#departureBonus').value) || 0;
	persistSession();
	updateTotals();
}

function adjustRestartCount(delta) {
    // Allow 0..4 restarts, step by +/- buttons
    const current = state.session.scoring.restartCount || 0;
    const next = Math.min(4, Math.max(0, current + (Number(delta) || 0)));
    state.session.scoring.restartCount = next;
    $('#restartCount').textContent = String(next);
    persistSession();
    updateTotals();
}

function updateTotals() {
	const chosen = state.tasks.filter(t => state.session.selectedTaskIds.includes(t.id));
	let total = 0;
	for (const task of chosen) {
		for (const obj of task.objectives) {
			const key = `${task.id}:${obj.id}`;
			if (state.session.scoring.objectives[key]) total += obj.points;
		}
	}
	const departure = state.session.scoring.departureBonus || 0;
    const restartBase = state.session.scoring.restartBonus || 0;
    const restartCount = state.session.scoring.restartCount || 0; // 0..4
    const factor = Math.max(0, 1 - 0.25 * restartCount);
    const restartAdjusted = Math.round(restartBase * factor);
	const grand = total + departure + restartAdjusted;
	state.session.scoring.total = grand;
	$('#totalScore').textContent = String(grand);
	persistSession();
}

// Timer
let timerInterval = null;
function toggleTimer() {
	if (state.timer.running) {
		state.timer.running = false;
		clearInterval(timerInterval);
		state.session.scoring.elapsedSec = Math.floor(state.timer.elapsedMs / 1000);
		$('#btn-timer').textContent = 'Start';
		persistSession();
		return;
	}
	state.timer.running = true;
	state.timer.start = Date.now() - state.timer.elapsedMs;
	$('#btn-timer').textContent = 'Stop';
	timerInterval = setInterval(() => {
		state.timer.elapsedMs = Date.now() - state.timer.start;
		const secs = Math.floor(state.timer.elapsedMs / 1000);
		$('#timerDisplay').textContent = formatTime(secs);
		$('#elapsedTime').textContent = String(secs);
	}, 200);
}

function resetTimer() {
	state.timer.running = false;
	clearInterval(timerInterval);
	state.timer.elapsedMs = 0;
	$('#btn-timer').textContent = 'Start';
	$('#timerDisplay').textContent = '00:00';
	$('#elapsedTime').textContent = '0';
	state.session.scoring.elapsedSec = 0;
	persistSession();
}

function formatTime(totalSeconds) {
	const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
	const s = String(totalSeconds % 60).padStart(2, '0');
	return `${m}:${s}`;
}

// Final Details
function handleFinalSubmit(e) {
	if (e) e.preventDefault();
	const referee = $('#referee').value.trim();
	const scorer = $('#scorer').value.trim();
	if (!referee || !scorer) { alert('Referee and Scorer are required.'); return; }
	state.session.final = {
		referee, scorer,
		teamMembers: $('#teamMembers').value.trim(),
		remarks: $('#remarks').value.trim(),
	};
	// snapshot selected tasks/objectives at save time for accurate historic detail views
	const selectedTasks = state.tasks.filter(t => state.session.selectedTaskIds.includes(t.id))
		.map(t => ({ id: t.id, name: t.name, objectives: t.objectives.map(o => ({ id: o.id, name: o.name, points: o.points })) }));
	state.session.snapshotTasks = selectedTasks;
	state.session.completedAt = Date.now();
	// Persist to rounds list
	const rounds = loadLocal('wer_rounds', []);
	rounds.push(state.session);
	saveLocal('wer_rounds', rounds);
	// clear current session
	state.session = null;
	saveLocal('wer_current_session', null);
	alert('Round saved');
	setView('export');
}

// Data Export
function renderExportTable() {
	const container = $('#export-table');
	const rounds = loadLocal('wer_rounds', []);
	const teamFilter = $('#filterTeam').value.trim().toLowerCase();
	const roundFilter = Number($('#filterRound').value) || null;
    const dayStr = $('#filterDateDay').value;
    const fromTime = dayStr ? new Date(dayStr + 'T00:00:00').getTime() : null;
    const toTime = dayStr ? new Date(dayStr + 'T23:59:59').getTime() : null;
	const filtered = rounds.filter(r => {
		const matchesTeam = !teamFilter || `${r.general.teamName} ${r.general.teamNumber}`.toLowerCase().includes(teamFilter);
		const matchesRound = !roundFilter || Number(r.general.roundNumber) === roundFilter;
        const t = (r.completedAt || r.createdAt) || 0;
        const matchesDay = !fromTime || (t >= fromTime && t <= toTime);
        return matchesTeam && matchesRound && matchesDay;
	});
	if (filtered.length === 0) { container.innerHTML = '<div class="muted">No rounds found.</div>'; return; }
	const table = document.createElement('table');
	table.innerHTML = `
		<thead>
			<tr>
                <th>Round</th><th>Team</th><th>Total</th><th>Time(s)</th><th>Date</th><th>Time</th>
			</tr>
		</thead>
		<tbody>
			${filtered.map(r => `
                <tr data-round-id="${r.completedAt || r.createdAt}">
					<td>${r.general.roundNumber}</td>
					<td>${escapeHtml(r.general.teamName)}</td>
					<td>${r.scoring.total}</td>
					<td>${r.scoring.elapsedSec}</td>
                    <td>${new Date(r.completedAt || r.createdAt).toLocaleDateString()}</td>
                    <td>${new Date(r.completedAt || r.createdAt).toLocaleTimeString()}</td>
				</tr>
			`).join('')}
		</tbody>
	`;
	container.innerHTML = '';
	container.appendChild(table);
	// Row click to show details
	$$('tbody tr', table).forEach(tr => {
		tr.style.cursor = 'pointer';
		tr.addEventListener('click', () => {
			const id = Number(tr.getAttribute('data-round-id'));
			showRoundDetails(id);
		});
	});
}

function showRoundDetails(id) {
	const rounds = loadLocal('wer_rounds', []);
	const r = rounds.find(x => (x.completedAt || x.createdAt) === id);
	if (!r) { alert('Run not found'); return; }
	// Build details using snapshotTasks when available
	const tasks = r.snapshotTasks && Array.isArray(r.snapshotTasks) && r.snapshotTasks.length ? r.snapshotTasks : state.tasks.filter(t => r.selectedTaskIds.includes(t.id));
	const objectiveChecked = r.scoring?.objectives || {};
	const restartBase = Number(r.scoring?.restartBonus || 0);
	const restartCount = Number(r.scoring?.restartCount || 0);
	const restartFactor = Math.max(0, 1 - 0.25 * restartCount);
	const restartAdjusted = Math.round(restartBase * restartFactor);
	const tasksHtml = tasks.map(t => {
		const items = (t.objectives || []).map(o => {
			const key = `${t.id}:${o.id}`;
			const done = objectiveChecked[key];
			return `<li>${done ? '✅' : '⬜️'} ${escapeHtml(o.name)} (+${o.points})`;
		}).join('');
		return `<div class="task-card"><div class="task-header"><strong>${escapeHtml(t.name)}</strong></div><ul class="muted" style="margin:8px 0 0 16px">${items || '<li>No objectives</li>'}</ul></div>`;
	}).join('');
    const body = `
		<div class="stack gap">
			<div class="grid-2 gap">
				<div><strong>Round:</strong> ${r.general.roundNumber}</div>
				<div><strong>Team:</strong> ${escapeHtml(r.general.teamName)}</div>
				<div><strong>Team #:</strong> ${escapeHtml(r.general.teamNumber || '')}</div>
				<div><strong>Group:</strong> ${escapeHtml(r.general.group || '')}</div>
				<div><strong>Seat:</strong> ${escapeHtml(r.general.venueSeat || '')}</div>
				<div><strong>Date:</strong> ${new Date(r.completedAt || r.createdAt).toLocaleString()}</div>
			</div>
			<div><strong>Total:</strong> ${r.scoring.total} &nbsp; <strong>Time:</strong> ${r.scoring.elapsedSec}s</div>
			<div class="grid-2 gap">
				<div><strong>Departure Bonus:</strong> ${r.scoring.departureBonus}</div>
				<div><strong>Restart Bonus (added):</strong> ${restartAdjusted} (restarts: ${restartCount})</div>
			</div>
			<div class="stack gap">${tasksHtml || '<div class="muted">No tasks selected</div>'}</div>
			<div class="stack gap">
				<div><strong>Referee:</strong> ${escapeHtml(r.final?.referee || '')}</div>
				<div><strong>Scorer:</strong> ${escapeHtml(r.final?.scorer || '')}</div>
				<div><strong>Team Members:</strong><br/> ${escapeHtml(r.final?.teamMembers || '')}</div>
				<div><strong>Remarks:</strong><br/> ${escapeHtml(r.final?.remarks || '')}</div>
			</div>
		</div>
    `;
    const safeTeam = String(r.general.teamName || 'Team').trim().replace(/\s+/g, '_');
    const printTitle = `${safeTeam}_${r.general.roundNumber}`;
    showModal('Run Details', body, null, true, undefined, { showPrint: true, printTitle });
}

function exportCSV() {
	const rounds = loadLocal('wer_rounds', []);
	const teamFilter = $('#filterTeam').value.trim().toLowerCase();
	const roundFilter = Number($('#filterRound').value) || null;
	const filtered = rounds.filter(r => {
		const matchesTeam = !teamFilter || `${r.general.teamName} ${r.general.teamNumber}`.toLowerCase().includes(teamFilter);
		const matchesRound = !roundFilter || Number(r.general.roundNumber) === roundFilter;
		return matchesTeam && matchesRound;
	});
	const headers = ['Round','Team Name','Team Number','Group','Seat','Total','Time(s)','Departure Bonus','Restart Bonus','Restart Count','Objectives'];
	const rows = filtered.map(r => {
		const chosen = r.selectedTaskIds;
		const objectives = [];
		for (const key in r.scoring.objectives) {
			if (r.scoring.objectives[key]) objectives.push(key);
		}
		return [
			r.general.roundNumber,
			r.general.teamName,
			r.general.teamNumber,
			r.general.group,
			r.general.venueSeat,
			r.scoring.total,
			r.scoring.elapsedSec,
			r.scoring.departureBonus,
			r.scoring.restartBonus,
			r.scoring.restartCount,
			objectives.join(' | ')
		];
	});
	const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'wer_rounds.csv';
	document.body.appendChild(a);
	a.click();
	URL.revokeObjectURL(url);
	a.remove();
}

function csvEscape(value) {
	const s = String(value ?? '');
	if (s.includes(',') || s.includes('"') || s.includes('\n')) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return s;
}

function clearRounds() {
	if (!confirm('This will delete all saved rounds. Continue?')) return;
	saveLocal('wer_rounds', []);
	renderExportTable();
}

// Modal
function showModal(title, body, onConfirm, allowHtml = false, onOpen, opts = {}) {
	$('#modal-title').textContent = title;
	const bodyEl = $('#modal-body');
	bodyEl.innerHTML = '';
	if (allowHtml && typeof body === 'string') bodyEl.innerHTML = body; else if (body instanceof HTMLElement) bodyEl.appendChild(body); else bodyEl.textContent = String(body ?? '');
	$('#modal').classList.remove('hidden');
	const cleanup = () => $('#modal').classList.add('hidden');
	$('#modal-cancel').onclick = cleanup;
	$('#modal-confirm').onclick = () => { const ok = onConfirm?.(); if (ok !== false) cleanup(); };
	// Optional Print button
	const printBtn = $('#modal-print');
    if (opts && opts.showPrint) {
        printBtn.style.display = '';
        printBtn.onclick = () => {
            const originalTitle = document.title;
            if (opts.printTitle) {
                document.title = opts.printTitle;
            }
            window.onafterprint = () => {
                document.title = originalTitle;
                window.onafterprint = null;
            };
            window.print();
        };
    } else {
		printBtn.style.display = 'none';
		printBtn.onclick = null;
	}
	onOpen?.();
}

// Helpers
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Events
function bindEvents() {
	$$('.tab-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
	$('#btn-new-round').addEventListener('click', handleNewRound);
	$('#btn-go-export').addEventListener('click', () => setView('export'));
	$('#form-general').addEventListener('submit', handleGeneralSubmit);
	$('#btn-add-task').addEventListener('click', () => openTaskEditor(null));
	$('#btn-task-next').addEventListener('click', openTaskConfirmation);
	$$('[data-nav="back"]').forEach(btn => btn.addEventListener('click', () => {
		if (state.currentStep > 1) setStep(state.currentStep - 1);
	}));
	$$('#window-3 [data-nav="next"]').forEach(btn => btn.addEventListener('click', () => setStep(4)));
	$('#form-final').addEventListener('submit', handleFinalSubmit);
	$('#btn-save-round').addEventListener('click', handleFinalSubmit);

	$('#btn-apply-departure').addEventListener('click', applyDeparture);
    $$('[data-restart]').forEach(btn => btn.addEventListener('click', (e) => {
        const attr = e.currentTarget.getAttribute('data-restart');
        const step = parseInt(attr, 10) || 0; // expects +1 or -1
        adjustRestartCount(step);
    }));
	$('#restartBonus').addEventListener('change', () => { state.session.scoring.restartBonus = Number($('#restartBonus').value) || 0; persistSession(); updateTotals(); });
	$('#btn-timer').addEventListener('click', toggleTimer);
	$('#btn-reset-timer').addEventListener('click', resetTimer);

	$('#filterTeam').addEventListener('input', renderExportTable);
	$('#filterRound').addEventListener('input', renderExportTable);
    $('#filterDateDay').addEventListener('change', renderExportTable);
	$('#btn-export-csv').addEventListener('click', exportCSV);
	$('#btn-clear-data').addEventListener('click', clearRounds);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
	loadInitialData();
	bindEvents();
	setView('home');
	renderExportTable();
});


