document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // Manually list your image files here.
    // Due to browser security, we cannot automatically read files from a folder.
    const imageUrls = [
        'images/Вибирати мотузку.png',
        'images/Видавати мотузку.png',
        'images/Закріпити мотузку.png',
        'images/Здійснювати контроль мотузки.png',
        'images/Здійснювати страховку.png',
        'images/Маркувати мотузку.png',
        'images/Наведення, виготовлення.png',
        'images/Натягування перил.png',
        'images/Проходження етапу.png',
        'images/Розібрати етап.png'
    ];
    
    const table = document.getElementById('editableTable');
    const addRowBtn = document.getElementById('addRowBtn');
    const saveBtn = document.getElementById('saveBtn');
    const openBtn = document.getElementById('openBtn');
    const fileInput = document.getElementById('fileInput');
    const exportBtn = document.getElementById('exportBtn');
    const addColBtn = document.getElementById('addColBtn');
    const removeColBtn = document.getElementById('removeColBtn');
    const brushBtn = document.getElementById('brushBtn');
    const sidebar = document.getElementById('sidebar');
    const controls = document.querySelector('.controls');

    if (!table || !addRowBtn || !sidebar || !saveBtn || !openBtn || !fileInput || !exportBtn || !controls || !addColBtn || !removeColBtn || !brushBtn) {
        console.error("Required element not found!");
        return;
    }

    let isBrushActive = false;

    // --- Image Loading for Sidebar ---
    imageUrls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.draggable = true;

        // Extract filename for the title attribute
        const filename = url.substring(url.lastIndexOf('/') + 1);
        img.title = filename; // This shows the filename on hover

        img.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', url);
        });
        sidebar.appendChild(img);
    });

    const tableBody = table.querySelector('tbody');

    if (!tableBody) {
        console.error("Table body not found!");
        return;
    }

    // --- Brush Functionality ---
    brushBtn.addEventListener('click', () => {
        isBrushActive = !isBrushActive;
        brushBtn.classList.toggle('brush-active');
    });

    // Function to add a remove button to a row
    const addRemoveButton = (row) => {
        const newCell = row.insertCell();
        const removeBtn = document.createElement('button');
        newCell.className = 'buttonRow';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            row.remove();
        });
        newCell.appendChild(removeBtn);
    };

    // --- Add remove buttons to initial rows ---
    tableBody.querySelectorAll('tr').forEach(addRemoveButton);

    // --- Drag and Drop Functionality ---
    tableBody.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
    });

    tableBody.addEventListener('drop', (e) => {
        e.preventDefault();
        let targetCell = e.target;

        // Traverse up to find the parent TD
        while (targetCell && targetCell.tagName !== 'TD') {
            targetCell = targetCell.parentElement;
        }

        if (targetCell && targetCell.tagName === 'TD') {
            const imageUrl = e.dataTransfer.getData('text/plain');
            if (imageUrl) {
                let wrapper = targetCell.querySelector('.cell-content-wrapper');

                // If wrapper doesn't exist, create it
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.className = 'cell-content-wrapper';
                    // Clear existing content (like text) and append the wrapper
                    targetCell.innerHTML = '';
                    targetCell.appendChild(wrapper);
                }

                const img = document.createElement('img');
                img.src = imageUrl;
                wrapper.appendChild(img); // Append image to wrapper
            }
        }
    });

    // --- Right-click to delete image and remove paint ---
    tableBody.addEventListener('contextmenu', (e) => {
        let actionTaken = false;

        // Check if the right-clicked element is an image
        if (e.target.tagName === 'IMG') {
            e.target.remove(); // Remove the image
            actionTaken = true;
        }

        // Find the cell that was clicked in
        const cell = e.target.closest('td');
        if (cell) {
            const borders = ['painted-top', 'painted-right', 'painted-bottom', 'painted-left'];
            // Check if any border is painted before removing them
            if (borders.some(b => cell.classList.contains(b))) {
                cell.classList.remove(...borders);
                actionTaken = true;
            }
        }

        // Prevent the browser's context menu only if an action was performed
        if (actionTaken) {
            e.preventDefault();
        }
    });

    // Function to make cell editable
    const makeCellEditable = (cell) => {
        const originalContent = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalContent;

        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        const saveContent = () => {
            cell.textContent = input.value;
            input.remove();
        };

        input.addEventListener('blur', saveContent);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveContent();
            } else if (e.key === 'Escape') {
                cell.textContent = originalContent;
                input.remove();
            }
        });
    };

    // Event listener for clicks on table cells
    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.tagName === 'TD' && !target.classList.contains('buttonRow')) {
            // If brush is active, handle painting and stop further actions
            if (isBrushActive) {
                const rect = target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const borderThreshold = 8; // How close to an edge to count as a click

                const distances = {
                    top: y,
                    bottom: rect.height - y,
                    left: x,
                    right: rect.width - x
                };

                // Find the minimum distance to determine the clicked edge
                const closestEdge = Object.keys(distances).reduce((a, b) => distances[a] < distances[b] ? a : b);

                if (distances[closestEdge] <= borderThreshold) {
                    target.classList.toggle(`painted-${closestEdge}`);
                }
                return;
            }

            // Prevent editing if cell contains an image
            if (target.querySelector('img')) {
                return;
            }
            // Check if the cell is not already being edited
            if (!target.querySelector('input')) {
                makeCellEditable(target);
            }
        }
    });

    // Event listener for the "Add Row" button
    addRowBtn.addEventListener('click', () => {
        const newRow = tableBody.insertRow();
        // Get column count from the header, minus "Actions"
        const columnCount = table.querySelector('thead tr').childElementCount - 1;

        for (let i = 0; i < columnCount; i++) {
            const newCell = newRow.insertCell();
            newCell.textContent = '-'; // Default text
        }
        addRemoveButton(newRow);
    });

    // --- Add/Remove Column Functionality ---
    addColBtn.addEventListener('click', () => {
        const headerRow = table.querySelector('thead tr');
        const headerCells = headerRow.querySelectorAll('th');
        // Get the second to last header (the last numbered one)
        const lastHeader = headerCells[headerCells.length - 2];
        const newColNumber = parseInt(lastHeader.textContent, 10) + 1;

        // Add new header cell
        const newHeader = document.createElement('th');
        newHeader.textContent = newColNumber;
        headerRow.insertBefore(newHeader, headerRow.lastElementChild);

        // Add new cell to each body row
        tableBody.querySelectorAll('tr').forEach(row => {
            const newCell = row.insertCell(row.cells.length - 1);
            newCell.textContent = '-';
        });
    });

    removeColBtn.addEventListener('click', () => {
        const headerRow = table.querySelector('thead tr');
        const headerCells = headerRow.querySelectorAll('th');

        // Prevent removing the last data column
        if (headerCells.length <= 2) {
            alert("Cannot remove the last column.");
            return;
        }

        // Remove the second to last header cell
        headerCells[headerCells.length - 2].remove();

        // Remove the corresponding cell from each body row
        tableBody.querySelectorAll('tr').forEach(row => {
            row.deleteCell(row.cells.length - 2);
        });
    });

    // --- Export as PNG ---
    exportBtn.addEventListener('click', async () => {
        const elementsToHide = [sidebar, controls];
        const actionsColumnCells = table.querySelectorAll('tr > :last-child');
        const tableImages = tableBody.querySelectorAll('img');
        const originalSrcs = new Map();

        // Helper function to convert image src to a data URL
        const toDataURL = async (img) => {
            const response = await fetch(img.src);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        // Hide elements
        elementsToHide.forEach(el => el.classList.add('export-hidden'));
        actionsColumnCells.forEach(cell => cell.classList.add('export-hidden'));

        try {
            // Temporarily replace image sources with data URLs
            await Promise.all(Array.from(tableImages).map(async (img) => {
                originalSrcs.set(img, img.src); // Save original src
                const dataUrl = await toDataURL(img);
                img.src = dataUrl;
            }));

            const canvas = await html2canvas(document.getElementById('main-content'));
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'table-export.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Error exporting table:", error);
            alert("Sorry, there was an error exporting the table.");
        } finally {
            // Restore original image sources
            tableImages.forEach(img => {
                if (originalSrcs.has(img)) {
                    img.src = originalSrcs.get(img);
                }
            });
            // Unhide elements
            elementsToHide.forEach(el => el.classList.remove('export-hidden'));
            actionsColumnCells.forEach(cell => cell.classList.remove('export-hidden'));
        }
    });


    // --- Save and Open Functionality ---

    // Save Table Data
    saveBtn.addEventListener('click', () => {
        const tableData = [];
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            // Iterate over cells, excluding the last one (actions column)
            for (let i = 0; i < cells.length - 1; i++) {
                const cell = cells[i];
                const images = cell.querySelectorAll('img');

                // Save which borders are painted
                const paintedBorders = {
                    top: cell.classList.contains('painted-top'),
                    right: cell.classList.contains('painted-right'),
                    bottom: cell.classList.contains('painted-bottom'),
                    left: cell.classList.contains('painted-left')
                };

                if (images.length > 0) {
                    // Convert the full image URL to a relative path for saving
                    const imageUrls = Array.from(images).map(img => {
                        try {
                            // Create a URL object to easily access the path
                            const url = new URL(img.src);
                            // Return the path, removing the leading '/'
                            return url.pathname.substring(1);
                        } catch (e) {
                            // Fallback for cases where URL parsing might fail
                            return img.getAttribute('src');
                        }
                    });
                    rowData.push({ type: 'images', content: imageUrls, paintedBorders: paintedBorders });
                } else {
                    rowData.push({ type: 'text', content: cell.textContent, paintedBorders: paintedBorders });
                }
            }
            tableData.push(rowData);
        });

        const jsonData = JSON.stringify(tableData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'table-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Trigger File Input
    openBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Read and Load File
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                rebuildTable(data);
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);

        // Reset file input to allow opening the same file again
        fileInput.value = '';
    });

    // Rebuild Table from Data
    const rebuildTable = (data) => {
        const tableHead = table.querySelector('thead');

        // Clear existing table
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.length === 0) {
            return; // Don't rebuild if there's no data
        }

        // --- Rebuild Header ---
        const headerRow = tableHead.insertRow();
        const columnCount = data[0].length; // Get column count from first row of data
        for (let i = 0; i < columnCount; i++) {
            const newHeader = document.createElement('th');
            newHeader.textContent = i + 1;
            headerRow.appendChild(newHeader);
        }
        // Add "Actions" header
        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = 'Actions';
        headerRow.appendChild(actionsHeader);

        // --- Rebuild Body ---
        data.forEach(rowData => {
            const newRow = tableBody.insertRow();
            rowData.forEach(cellData => {
                const newCell = newRow.insertCell();
                if (cellData.type === 'images') {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'cell-content-wrapper';
                    cellData.content.forEach(imageUrl => {
                        const img = document.createElement('img');
                        // Loaded imageUrl is relative, browser handles the rest
                        img.src = imageUrl;
                        wrapper.appendChild(img);
                    });
                    newCell.appendChild(wrapper);
                } else {
                    newCell.textContent = cellData.content;
                }
                // Restore painted state
                if (cellData.paintedBorders) {
                    if (cellData.paintedBorders.top) newCell.classList.add('painted-top');
                    if (cellData.paintedBorders.right) newCell.classList.add('painted-right');
                    if (cellData.paintedBorders.bottom) newCell.classList.add('painted-bottom');
                    if (cellData.paintedBorders.left) newCell.classList.add('painted-left');
                }
            });
            addRemoveButton(newRow);
        });
    };
});
