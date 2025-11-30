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
    const sidebar = document.getElementById('sidebar');
    const controls = document.querySelector('.controls');

    if (!table || !addRowBtn || !sidebar || !saveBtn || !openBtn || !fileInput || !exportBtn || !controls) {
        console.error("Required element not found!");
        return;
    }

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

    // Function to add a remove button to a row
    const addRemoveButton = (row) => {
        const newCell = row.insertCell();
        const removeBtn = document.createElement('button');
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

    // --- Right-click to delete image ---
    tableBody.addEventListener('contextmenu', (e) => {
        // Check if the right-clicked element is an image
        if (e.target.tagName === 'IMG') {
            e.preventDefault(); // Prevent the browser's context menu
            e.target.remove(); // Remove the image
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
        if (target && target.tagName === 'TD') {
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
        const columnCount = table.querySelector('thead tr').childElementCount - 1; // -1 for actions column

        for (let i = 0; i < columnCount; i++) {
            const newCell = newRow.insertCell();
            newCell.textContent = 'New Data'; // Default text
        }
        addRemoveButton(newRow);
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
                    rowData.push({ type: 'images', content: imageUrls });
                } else {
                    rowData.push({ type: 'text', content: cell.textContent });
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
        // Clear existing table body
        tableBody.innerHTML = '';

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
            });
            addRemoveButton(newRow);
        });
    };
});
