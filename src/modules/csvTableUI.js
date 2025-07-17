// Socket.IO für Realtime-Updates
let socket;
let tableRows = [];

async function fetchCsv() {
    const response = await fetch('/dummy.csv');
    const text = await response.text();
    return text;
}

function parseCsv(text) {
    const rows = text.split('\n').map(row => row.split(','));
    return rows;
}

function renderTable(rows) {
    tableRows = rows;
    const container = document.getElementById('csv-table-container');
    container.innerHTML = '';
    const table = document.createElement('table');
    rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        row.forEach((cell, j) => {
            const td = document.createElement('td');
            td.contentEditable = true;
            td.innerText = cell;
            td.dataset.row = i;
            td.dataset.col = j;
            td.addEventListener('input', (e) => {
                tableRows[i][j] = td.innerText;
                sendUpdate(i, j, td.innerText);
            });
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
    container.appendChild(table);
}

function sendUpdate(row, col, value) {
    if (socket) {
        socket.emit('csv-update', { row, col, value });
    }
}

function applyUpdate({ row, col, value }) {
    const table = document.querySelector('#csv-table-container table');
    if (table && table.rows[row] && table.rows[row].cells[col]) {
        table.rows[row].cells[col].innerText = value;
        tableRows[row][col] = value;
    }
}

async function initCsvTable() {
    const csv = await fetchCsv();
    const rows = parseCsv(csv);
    renderTable(rows);
    // Socket.IO initialisieren
    socket = io();
    socket.on('csv-update', applyUpdate);
}

document.addEventListener('DOMContentLoaded', initCsvTable);
