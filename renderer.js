const { ipcRenderer } = require('electron');

let todos = [];
let workspaces = [];
let currentWorkspaceId = null;
let todoIdCounter = 1;
let workspaceIdCounter = 1;
let showFinished = false;
let currentTransparency = 85; // Default transparency
let currentWindowHeight = 500; // Default window height
let currentWindowWidth = 350; // Default window width
let isInFullscreenMode = false; // Track if we're over fullscreen
let bgColor = { r: 25, g: 25, b: 25 }; // Base background color for app-container
const minAlpha = 0.09; // Alpha when slider is at max (most transparent) - formerly 0.1
const maxAlpha = 0.765; // Alpha when slider is at min (least transparent) - formerly 0.85
let collapsedTasks = new Set(); // Track which tasks have collapsed subtasks

// New variables for icon badge and detailed task count features
let iconBadgeEnabled = false;
let iconBadgeContent = 'both'; // 'none', 'tasks', 'subtasks', 'both', 'separate'
let iconBadgeScope = 'cumulative'; // 'cumulative' or 'workspace'

// New variables for date functionality
let dateFormat = 'relative'; // 'relative', 'dmy', 'mdy', 'monthday'
let currentDatePickerTaskId = null; // Track which task is being edited for date

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    // Load existing data and settings
    const data = await ipcRenderer.invoke('get-data') || {};
    todos = data.todos || [];
    workspaces = data.workspaces || [];
    
    // Initialize counters based on existing data to prevent duplicates
    if (todos.length > 0) {
        todoIdCounter = Math.max(...todos.map(todo => todo.id)) + 1;
    } else {
        todoIdCounter = 1;
    }

    if (workspaces.length > 0) {
        workspaceIdCounter = Math.max(...workspaces.map(workspace => workspace.id)) + 1;
    } else {
        workspaceIdCounter = 1; // Keep it 1 if no workspaces, so the first one is 1
    }
    
    // Create default workspace if none exist
    if (workspaces.length === 0) {
        workspaces.push({
            id: workspaceIdCounter++, // Use and increment the counter
            name: 'Personal',
            isDefault: true
        });
    }
    
    // Set current workspace to the first one or default
    const defaultWorkspace = workspaces.find(ws => ws.isDefault);
    currentWorkspaceId = defaultWorkspace ? defaultWorkspace.id : (workspaces.length > 0 ? workspaces[0].id : null);
    if (currentWorkspaceId === null && workspaces.length > 0) { // Fallback if default somehow not set but workspaces exist
        currentWorkspaceId = workspaces[0].id;
    }
    
    await loadSettings();
    
    renderWorkspaces();
    renderTodos();
    updateTaskCount();
    applyTransparency();
    
    // Initialize update UI
    initializeUpdateUI();
    
    // Ensure container starts in initial animation state
    const container = document.getElementById('appContainer');
    if (container) {
        container.classList.remove('window-open'); // Start without the open class
    }
    
    // Set up event listeners
    setupEventListeners();
});

async function loadSettings() {
    try {
        const settings = await ipcRenderer.invoke('get-settings') || {};
        // Ensure transparency is a number and within valid range, otherwise default
        if (typeof settings.transparency === 'number' && settings.transparency >= 0 && settings.transparency <= 100) {
            currentTransparency = settings.transparency;
        } else {
            currentTransparency = 85; // Default transparency
        }
        
        // Validate and set window height from settings, default to 500px
        if (typeof settings.windowHeight === 'number' && settings.windowHeight >= 400 && settings.windowHeight <= 1000) {
            currentWindowHeight = settings.windowHeight;
        } else {
            currentWindowHeight = 500; // Default height
        }
        
        // Validate and set window width from settings, default to 350px
        if (typeof settings.windowWidth === 'number' && settings.windowWidth >= 300 && settings.windowWidth <= 500) {
            currentWindowWidth = settings.windowWidth;
        } else {
            currentWindowWidth = 350; // Default width
        }
        
        // Load new icon badge settings
        iconBadgeEnabled = settings.iconBadgeEnabled || false;
        iconBadgeContent = settings.iconBadgeContent || 'both';
        iconBadgeScope = settings.iconBadgeScope || 'cumulative';
        
        // Load date format setting
        dateFormat = settings.dateFormat || 'relative';
        
        const slider = document.getElementById('transparencySlider');
        const valueDisplay = document.getElementById('transparencyValue'); // Renamed for clarity
        if (slider && valueDisplay) {
            slider.value = currentTransparency;
            valueDisplay.textContent = currentTransparency + '%';
        }
        
        const heightSlider = document.getElementById('windowHeightSlider');
        const heightDisplay = document.getElementById('windowHeightValue');
        if (heightSlider && heightDisplay) {
            heightSlider.value = currentWindowHeight;
            heightDisplay.textContent = currentWindowHeight + 'px';
        }

        const widthSlider = document.getElementById('windowWidthSlider');
        const widthDisplay = document.getElementById('windowWidthValue');
        if (widthSlider && widthDisplay) {
            widthSlider.value = currentWindowWidth;
            widthDisplay.textContent = currentWindowWidth + 'px';
        }
        
        // Update UI for icon badge settings
        updateIconBadgeSettingsUI();
        
        applyWindowHeight();
        applyWindowWidth();
        
    } catch (error) {
        console.log('Error loading settings or no settings found, using defaults', error);
        currentTransparency = 85; // Fallback default
        currentWindowHeight = 500; // Fallback default
        currentWindowWidth = 350; // Fallback default
        iconBadgeEnabled = false;
        iconBadgeContent = 'both';
        iconBadgeScope = 'cumulative';
        
        // Attempt to update UI even on error, with default
        const slider = document.getElementById('transparencySlider');
        const valueDisplay = document.getElementById('transparencyValue');
        if (slider && valueDisplay) {
            slider.value = currentTransparency;
            valueDisplay.textContent = currentTransparency + '%';
        }
        
        const heightSlider = document.getElementById('windowHeightSlider');
        const heightDisplay = document.getElementById('windowHeightValue');
        if (heightSlider && heightDisplay) {
            heightSlider.value = currentWindowHeight;
            heightDisplay.textContent = currentWindowHeight + 'px';
        }

        const widthSlider = document.getElementById('windowWidthSlider');
        const widthDisplay = document.getElementById('windowWidthValue');
        if (widthSlider && widthDisplay) {
            widthSlider.value = currentWindowWidth;
            widthDisplay.textContent = currentWindowWidth + 'px';
        }
        
        updateIconBadgeSettingsUI();
        applyWindowHeight();
        applyWindowWidth();
    }
}

async function saveSettings() {
    const settings = {
        transparency: currentTransparency,
        windowHeight: currentWindowHeight,
        windowWidth: currentWindowWidth,
        iconBadgeEnabled: iconBadgeEnabled,
        iconBadgeContent: iconBadgeContent,
        iconBadgeScope: iconBadgeScope,
        dateFormat: dateFormat
    };
    await ipcRenderer.invoke('save-settings', settings);
}

function setupEventListeners() {
    const mainInput = document.getElementById('mainTaskInput');
    
    // Add task on Enter key
    mainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addMainTask();
        }
    });
    
    // Handle window shown event with fullscreen detection
    ipcRenderer.on('window-shown', (event, data) => {
        isInFullscreenMode = data && data.isFullscreen;
        
        if (isInFullscreenMode) {
            // Temporarily set to 100% opacity for fullscreen visibility
            const container = document.getElementById('appContainer');
            container.style.background = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 1)`;
            
            // Fade back to normal transparency after a short delay
            setTimeout(() => {
                applyTransparency();
            }, 1000);
        }
        
        mainInput.focus();
    });
    
    // New handler for opening animation
    ipcRenderer.on('trigger-window-open-animation', (event, data) => {
        isInFullscreenMode = data && data.isFullscreen;
        const container = document.getElementById('appContainer');
        const mainInput = document.getElementById('mainTaskInput');

        // 1. Clean up classes from previous animations
        container.classList.remove('window-open');
        container.classList.remove('window-closing');
        container.classList.remove('app-container-animating'); // Remove if lingering

        // 2. Temporarily disable any direct transitions and set initial visual state
        container.style.transition = 'none';
        container.style.opacity = '0'; // Explicitly set to ensure it's hidden
        container.style.transform = 'scale(0.95)'; // Explicitly set

        // 3. Handle background state
        if (isInFullscreenMode) {
            container.style.background = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 1)`;
        } else {
            applyTransparency(); // Apply normal transparency based on settings
        }

        // 4. Force reflow to apply the above styles immediately without transition
        void container.offsetHeight;

        // 5. Setup transitionend listener (once) to clean up animation class
        const onTransitionEnd = (e) => {
            // Ensure we're reacting to the end of one of our animated properties
            if (e.target === container && (e.propertyName === 'opacity' || e.propertyName === 'transform')) {
                // If opening is complete (opacity 1), remove the animating class.
                // Check opacity to ensure this only runs after opening, not other transitions.
                if (window.getComputedStyle(container).opacity === '1') {
                    container.classList.remove('app-container-animating');
                }
                container.removeEventListener('transitionend', onTransitionEnd);
            }
        };
        container.addEventListener('transitionend', onTransitionEnd);

        // 6. In the next animation frame: Add classes to trigger animation
        requestAnimationFrame(() => {
            container.style.transition = ''; // Clear inline transition override
            container.style.opacity = '';    // Clear inline opacity, let CSS classes control it
            container.style.transform = ''; // Clear inline transform
            
            container.classList.add('app-container-animating'); // Add class that has the transition
            container.classList.add('window-open');         // Add class that defines target state
        });
        
        // Fullscreen transparency adjustment after window is visible
        if (isInFullscreenMode) {
            setTimeout(() => {
                if (isInFullscreenMode) { 
                    applyTransparency();
                }
            }, 550); // Delay slightly longer than animation
        }

        if (mainInput) {
            mainInput.focus();
        }
    });
    
    // Handle window hiding event
    ipcRenderer.on('window-hiding', () => {
        isInFullscreenMode = false; // Reset fullscreen mode tracker
        const container = document.getElementById('appContainer');
        if (container) {
            // For closing, we expect .window-closing to have its own transition (as per current styles.css)
            // So, we don't need to add/remove .app-container-animating here unless we change styles.css for closing.
            container.classList.remove('window-open');
            container.classList.add('window-closing');

            // Optional: Clean up .app-container-animating if it was somehow left from opening
            // container.classList.remove('app-container-animating');
        }
    });
    
    // Add keyboard support for date picker
    document.addEventListener('keydown', (e) => {
        const datePicker = document.getElementById('datePicker');
        if (datePicker && e.key === 'Escape') {
            closeDatePicker();
            e.preventDefault();
        }
    });
}

// Settings functions
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const mainSettingsIcon = document.getElementById('settingsIcon'); // Get the main settings icon
    const isVisible = panel.style.display !== 'none';

    if (isVisible) {
        // Panel is currently visible, so we are hiding it
        panel.style.display = 'none';
        if (mainSettingsIcon) mainSettingsIcon.style.display = 'flex'; // Show main settings icon
    } else {
        // Panel is currently hidden, so we are showing it
        panel.style.display = 'block';
        if (mainSettingsIcon) mainSettingsIcon.style.display = 'none'; // Hide main settings icon
    }
}

function updateTransparency(value) {
    currentTransparency = parseInt(value);
    document.getElementById('transparencyValue').textContent = value + '%';
    applyTransparency();
    saveSettings(); 
}

// Functions for window height slider
function updateWindowHeightValue(value) {
    document.getElementById('windowHeightValue').textContent = value;
}

function applyWindowHeightSetting(value) {
    updateWindowHeight(value);
}

function updateWindowHeight(value) {
    const height = parseInt(value, 10);
    if (!isNaN(height) && height >= 400 && height <= 1000) {
        currentWindowHeight = height;
        document.getElementById('windowHeightValue').textContent = height;
        applyWindowHeight();
        saveSettings();
    }
}

function applyWindowHeight() {
    const container = document.getElementById('appContainer');
    container.style.height = currentWindowHeight + 'px';
    
    // Update the window size through IPC
    ipcRenderer.send('update-window-size', { height: currentWindowHeight });
}

// Functions for window width slider
function updateWindowWidthValue(value) {
    document.getElementById('windowWidthValue').textContent = value;
}

function applyWindowWidthSetting(value) {
    updateWindowWidth(value);
}

function updateWindowWidth(value) {
    const width = parseInt(value, 10);
    if (!isNaN(width) && width >= 300 && width <= 500) {
        currentWindowWidth = width;
        document.getElementById('windowWidthValue').textContent = width;
        applyWindowWidth();
        saveSettings();
    }
}

function applyWindowWidth() {
    const container = document.getElementById('appContainer');
    container.style.width = currentWindowWidth + 'px';
    
    // Update the window size through IPC
    ipcRenderer.send('update-window-size', { width: currentWindowWidth });
}

function applyTransparency() {
    const container = document.getElementById('appContainer');
    const targetOpacityForBackground = currentTransparency / 100;
    
    // This sets the base background color for the app container,
    // which is intended to be the layer that shows the blur and desktop through it.
    container.style.background = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${targetOpacityForBackground})`;
    
    // The actual window opacity in Electron is kept at 1 (fully opaque).
    // The transparency effect comes from this background and how content is layered on it.
    // Child elements with their own backgrounds will sit on top of this.
}

function quitApp() {
    ipcRenderer.send('quit-app');
}

// Workspace functions
function renderWorkspaces() {
    const container = document.getElementById('workspacesScroll');
    container.innerHTML = ''; // Clear previous buttons
    
    workspaces.forEach(workspace => {
        const workspaceBtn = document.createElement('button');
        workspaceBtn.className = `workspace-btn ${workspace.id === currentWorkspaceId ? 'active' : ''}`;
        workspaceBtn.setAttribute('data-workspace-id', workspace.id);
        
        const workspaceNameSpan = document.createElement('span');
        workspaceNameSpan.className = 'workspace-name';
        workspaceNameSpan.textContent = escapeHtml(workspace.name);
        workspaceBtn.appendChild(workspaceNameSpan);

        workspaceBtn.onclick = () => {
            // Prevent click action if input is currently focused within this button
            if (workspaceBtn.querySelector('input.workspace-rename-input:focus')) {
                return;
            }
            switchWorkspace(workspace.id);
        };
        
        workspaceBtn.ondblclick = () => {
            showRenameWorkspaceInput(workspace.id, workspaceBtn, workspaceNameSpan);
        };

        // Add right-click context menu for non-default workspaces
        workspaceBtn.oncontextmenu = (e) => {
            e.preventDefault();
            if (!workspace.isDefault) {
                if (confirm(`Delete workspace "${workspace.name}" and all its tasks?`)) {
                    deleteWorkspace(workspace.id);
                }
            } else {
                alert("The default workspace cannot be deleted.");
            }
        };
        
        container.appendChild(workspaceBtn);
    });
}

function showRenameWorkspaceInput(workspaceId, workspaceBtn, nameSpan) {
    const currentName = nameSpan.textContent;
    nameSpan.style.display = 'none'; // Hide the span

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'workspace-rename-input workspace-input'; // Reuse some styling
    input.value = currentName;
    input.maxLength = 15;
    input.style.width = Math.max(80, currentName.length * 8) + 'px'; // Dynamic width

    // Insert input before the (now hidden) name span
    workspaceBtn.insertBefore(input, nameSpan);
    input.focus();
    input.select();

    const handleRename = () => {
        const newName = input.value.trim();
        // Restore span visibility
        nameSpan.style.display = 'inline';

        if (newName && newName !== currentName && !workspaces.some(w => w.id !== workspaceId && w.name.toLowerCase() === newName.toLowerCase())) {
            const wsToRename = workspaces.find(w => w.id === workspaceId);
            if (wsToRename) {
                wsToRename.name = newName;
                saveData();
                nameSpan.textContent = escapeHtml(newName); // Update span directly for immediate feedback
            }
        }
        input.remove(); // Remove input field
    };

    input.addEventListener('blur', handleRename);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur(); // Trigger blur to handle rename
        } else if (e.key === 'Escape') {
            nameSpan.style.display = 'inline'; // Restore span
            input.remove(); // Remove input field without saving
        }
    });
}

function switchWorkspace(workspaceId, skipAnimation = false) {
    const previousWorkspaceId = currentWorkspaceId;
    currentWorkspaceId = workspaceId;
    
    renderWorkspaces();
    
    if (!skipAnimation && previousWorkspaceId !== workspaceId) {
        // Add switching animation class
        const container = document.getElementById('todosContainer');
        container.classList.add('todos-switching');
        
        setTimeout(() => {
            renderTodos();
            updateTaskCount();
            // Update icon badge settings UI in case workspace selection changed
            updateIconBadgeSettingsUI();
            container.classList.remove('todos-switching');
        }, 150);
    } else {
        renderTodos();
        updateTaskCount();
        updateIconBadgeSettingsUI();
    }
}

function showAddWorkspaceInput() {
    const container = document.getElementById('workspacesScroll');
    const addBtn = document.getElementById('addWorkspaceBtn');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'workspace-input';
    input.placeholder = 'Workspace name';
    input.maxLength = 15;
    
    let addWorkspaceCalled = false; // Moved this up for clarity with handleConfirm
    const handleConfirm = () => {
        if (addWorkspaceCalled) return;
        addWorkspaceCalled = true;

        if (input.parentNode) { 
            const name = input.value.trim();
            if (name) {
                addWorkspace(name, input); 
            } else {
                if (input.parentNode) input.remove();
                if (addBtn) addBtn.style.display = 'flex';
            }
        } else {
             if (addBtn) addBtn.style.display = 'flex';
        }
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            if (input.parentNode) input.remove();
            if (addBtn) addBtn.style.display = 'flex';
        }
    });
    
    input.addEventListener('blur', handleConfirm);
        
    addBtn.style.display = 'none';
    container.appendChild(input);
    input.focus();
}

function addWorkspace(name, inputFieldToRemove) {
    if (!name || workspaces.some(w => w.name.toLowerCase() === name.toLowerCase())) {
        if (inputFieldToRemove && inputFieldToRemove.parentNode) {
            inputFieldToRemove.remove();
        }
        const addBtn = document.getElementById('addWorkspaceBtn');
        if (addBtn) addBtn.style.display = 'flex';
        // Optionally, provide feedback like an alert or inline message if name is duplicate/empty
        // alert('Workspace name is empty or already exists.'); 
        return;
    }
    
    const newWorkspace = {
        id: workspaceIdCounter++,
        name: name,
        isDefault: false
    };
    
    workspaces.push(newWorkspace);
    // currentWorkspaceId = newWorkspace.id; // switchWorkspace will set this
    
    if (inputFieldToRemove && inputFieldToRemove.parentNode) {
        inputFieldToRemove.remove();
    }
    const addBtn = document.getElementById('addWorkspaceBtn');
    if (addBtn) addBtn.style.display = 'flex';
    
    renderWorkspaces(); // Render all workspace buttons, including the new one and updating active states
    switchWorkspace(newWorkspace.id, true); // Switch to the new workspace, skip animation
    // updateTaskCount(); // Called by switchWorkspace
    saveData();
}

function deleteWorkspace(workspaceId) {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    if (workspace.isDefault) {
        alert("The default workspace cannot be deleted.");
        return;
    }
    
    if (confirm(`Delete "${workspace.name}" workspace and all its tasks?`)) {
        // Remove all todos from this workspace
        todos = todos.filter(todo => todo.workspaceId !== workspaceId);
        
        // Remove workspace
        workspaces = workspaces.filter(w => w.id !== workspaceId);
        
        // Switch to another workspace or create a default one
        if (currentWorkspaceId === workspaceId) {
            if (workspaces.length > 0) {
                currentWorkspaceId = workspaces[0].id;
            } else {
                // All workspaces deleted, create a new default one
                const newDefaultWorkspace = {
                    id: workspaceIdCounter++, // Ensure workspaceIdCounter is available and correct
                    name: 'Personal',
                    isDefault: true
                };
                workspaces.push(newDefaultWorkspace);
                currentWorkspaceId = newDefaultWorkspace.id;
            }
        }
        
        renderWorkspaces();
        renderTodos();
        updateTaskCount();
        saveData();
    }
}

function addMainTask() {
    const input = document.getElementById('mainTaskInput');
    const text = input.value.trim();
    
    if (text === '') return;
    
    const newTodo = {
        id: todoIdCounter++,
        text: text,
        completed: false,
        subtasks: [],
        workspaceId: currentWorkspaceId
    };
    
    todos.push(newTodo);
    input.value = '';
    
    renderTodos();
    updateTaskCount();
    saveData();
}

function toggleMainTask(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (!todo.completed) {
        const todoElement = document.querySelector(`[data-todo-id="${id}"]`);
        const checkbox = todoElement ? todoElement.querySelector('.checkbox') : null;
        
        if (todoElement && checkbox) {
            // Add checkbox checking animation
            checkbox.classList.add('checking');
            // No need for task-completing class with new animation, unless a different initial feedback is desired.
            // todoElement.classList.add('task-completing'); 

            // Remove checking animation after it plays
            setTimeout(() => {
                checkbox.classList.remove('checking');
            }, 300); // Corresponds to .checkbox.checking::after transition
            
            // Complete the task data after a very short delay to allow checkbox animation to start
            setTimeout(() => {
                todo.completed = true;
                saveData(); // Save data change
                
                // Add animation class
                todoElement.classList.add('completing');
                console.log('Animation started for todo:', id); // Debug log
                
                // Wait for animation to complete before re-rendering
                setTimeout(() => {
                    console.log('Animation finished, re-rendering'); // Debug log
                    renderTodos();
                    updateTaskCount();
                }, 700); // Match new animation duration (0.7s)
                
            }, 50);
        } else {
            // Fallback if element not found (should not happen ideally)
            todo.completed = true;
            saveData();
            renderTodos();
            updateTaskCount();
        }
        
    } else {
        // Unchecking a completed task - simple and immediate
        todo.completed = false;
        renderTodos();
        updateTaskCount();
        saveData();
    }
}

function deleteMainTask(id) {
    // Remove immediately from data
    todos = todos.filter(t => t.id !== id);
    saveData();
    
    // Find element and animate if it exists
    const todoElement = document.querySelector(`[data-todo-id="${id}"]`);
    if (todoElement) {
        todoElement.classList.add('completing');
    }
    
    // Re-render after short delay
    setTimeout(() => {
        renderTodos();
        updateTaskCount();
    }, 50);
}

function addSubtask(mainTaskId) {
    const input = document.querySelector(`#subtask-input-${mainTaskId}`);
    const text = input.value.trim();
    
    if (text === '') return;
    
    const todo = todos.find(t => t.id === mainTaskId);
    if (todo) {
        todo.subtasks.push({
            id: Date.now(), // Simple ID for subtasks
            text: text,
            completed: false
        });
        
        input.value = '';
        renderTodos();
        updateTaskCount();
        saveData();
    }
}

function toggleSubtask(mainTaskId, subtaskId) {
    const todo = todos.find(t => t.id === mainTaskId);
    if (todo) {
        const subtask = todo.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
            if (!subtask.completed) {
                const subtaskElement = document.querySelector(`[data-todo-id="${mainTaskId}"] .subtask:has(.checkbox[onclick*="${CSS.escape(subtaskId)}"])`);
                const checkbox = subtaskElement ? subtaskElement.querySelector('.checkbox') : null;
                
                if (checkbox) {
                    checkbox.classList.add('checking');
                    setTimeout(() => {
                        checkbox.classList.remove('checking');
                    }, 300); // Match checkbox animation time
                }
                
                // Complete after short delay for checkbox animation
                setTimeout(() => {
                    subtask.completed = true;
                    // Subtasks don't have a separate 'completing' animation for removal, they just re-render
                    renderTodos(); 
                    updateTaskCount();
                    saveData();
                }, 100); // Small delay
            } else {
                // Unchecking subtask - immediate
                subtask.completed = false;
                renderTodos();
                updateTaskCount();
                saveData();
            }
        }
    }
}

function deleteSubtask(mainTaskId, subtaskId) {
    const todo = todos.find(t => t.id === mainTaskId);
    if (todo) {
        todo.subtasks = todo.subtasks.filter(s => s.id !== subtaskId);
        renderTodos();
        updateTaskCount();
        saveData();
    }
}

function toggleSubtaskCollapse(taskId) {
    if (collapsedTasks.has(taskId)) {
        collapsedTasks.delete(taskId);
    } else {
        collapsedTasks.add(taskId);
    }
    renderTodos();
}

// Drag and drop functionality
let draggedElement = null;
let draggedTodoId = null;

function handleDragStart(e) {
    draggedElement = e.target;
    draggedTodoId = parseInt(e.target.getAttribute('data-todo-id'));
    e.target.style.opacity = '0.5';
    e.target.classList.add('dragging'); // Add class to identify dragging element
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const container = document.getElementById('todosContainer'); // Only allow dragging in active tasks
    const afterElement = getDragAfterElement(container, e.clientY);
    
    // Clear previous indicators
    document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
    
    const indicator = createDropIndicator();
    if (afterElement == null) {
        container.appendChild(indicator);
    } else {
        container.insertBefore(indicator, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const container = document.getElementById('todosContainer');
    const indicator = container.querySelector('.drop-indicator');
    if (indicator) indicator.remove();
    
    const afterElement = getDragAfterElement(container, e.clientY);
    reorderTodos(draggedTodoId, afterElement ? parseInt(afterElement.getAttribute('data-todo-id')) : null);
}

function handleDragEnd(e) {
    if (e.target) {
        e.target.style.opacity = '';
        e.target.classList.remove('dragging');
    }
    draggedElement = null;
    draggedTodoId = null;
    
    // Clean up any remaining drop indicators
    document.querySelectorAll('.drop-indicator').forEach(indicator => {
        indicator.remove();
    });
}

function createDropIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    return indicator;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Simplified reorder logic
function reorderTodos(draggedId, beforeId) {
    const activeWorkspaceTodos = todos.filter(todo => todo.workspaceId === currentWorkspaceId && !todo.completed);
    const otherTodos = todos.filter(todo => !(todo.workspaceId === currentWorkspaceId && !todo.completed));

    const draggedTodo = activeWorkspaceTodos.find(todo => todo.id === draggedId);
    if (!draggedTodo) return;

    // Remove dragged todo
    const draggedIndex = activeWorkspaceTodos.indexOf(draggedTodo);
    activeWorkspaceTodos.splice(draggedIndex, 1);

    if (beforeId === null) {
        // Dropped at the end
        activeWorkspaceTodos.push(draggedTodo);
    } else {
        // Dropped before another item
        const beforeIndex = activeWorkspaceTodos.findIndex(todo => todo.id === beforeId);
        if (beforeIndex !== -1) {
            activeWorkspaceTodos.splice(beforeIndex, 0, draggedTodo);
        } else {
            // Fallback: add to end if beforeId not found (should not happen)
            activeWorkspaceTodos.push(draggedTodo);
        }
    }

    todos = [...activeWorkspaceTodos, ...otherTodos];
    
    saveData();
    renderTodos();
}

function renderTodos() {
    const activeContainer = document.getElementById('todosContainer');
    const finishedContainer = document.getElementById('finishedContainer');
    const finishedHeader = document.getElementById('finishedHeader');
    const toggleFinishedBtn = document.getElementById('toggleFinished');
    
    // Clear containers
    activeContainer.innerHTML = '';
    finishedContainer.innerHTML = '';
    
    // Filter todos by current workspace
    const workspaceTodos = todos.filter(todo => todo.workspaceId === currentWorkspaceId);
    
    // Separate active and completed todos
    const activeTodos = workspaceTodos.filter(todo => !todo.completed);
    const completedTodos = workspaceTodos.filter(todo => todo.completed);
    
    // Render active todos
    activeTodos.forEach(todo => {
        const todoElement = createTodoElement(todo, false);
        activeContainer.appendChild(todoElement);
    });
    
    // Render completed todos
    completedTodos.forEach(todo => {
        const todoElement = createTodoElement(todo, true);
        finishedContainer.appendChild(todoElement);
    });
    
    // Show/hide finished section controls
    if (completedTodos.length > 0) {
        toggleFinishedBtn.style.display = 'inline-block';
        if (showFinished) {
            finishedHeader.style.display = 'flex';
            finishedContainer.style.display = 'block';
            toggleFinishedBtn.textContent = 'Hide Finished';
        } else {
            finishedHeader.style.display = 'none';
            finishedContainer.style.display = 'none';
            toggleFinishedBtn.textContent = `Show Finished (${completedTodos.length})`;
        }
    } else {
        toggleFinishedBtn.style.display = 'none';
        finishedHeader.style.display = 'none';
        finishedContainer.style.display = 'none';
    }
}

function createTodoElement(todo, isCompleted) {
    const todoDiv = document.createElement('div');
    todoDiv.className = `todo-item ${isCompleted ? 'completed' : ''}`;
    todoDiv.setAttribute('data-todo-id', todo.id);
    
    // Make todo item draggable
    todoDiv.draggable = true;
    todoDiv.addEventListener('dragstart', handleDragStart);
    todoDiv.addEventListener('dragover', handleDragOver);
    todoDiv.addEventListener('drop', handleDrop);
    todoDiv.addEventListener('dragend', handleDragEnd);
    
    // Prevent dragging when clicking interactive elements
    todoDiv.addEventListener('mousedown', (e) => {
        if (e.target.matches('.checkbox, .delete-btn, .collapse-arrow, input, button')) {
            todoDiv.draggable = false;
            setTimeout(() => { todoDiv.draggable = true; }, 0);
        }
    });
    
    // Main task
    const mainTaskDiv = document.createElement('div');
    mainTaskDiv.className = `main-task ${todo.completed ? 'completed' : ''}`;
    
    const hasSubtasks = todo.subtasks.length > 0;
    const isCollapsed = collapsedTasks.has(todo.id);
    const pendingSubtasksCount = getPendingSubtasksCount(todo);
    const subtaskCountDisplay = hasSubtasks && pendingSubtasksCount > 0 ? `<span class="pending-subtasks-count">${pendingSubtasksCount}</span>` : '';
    const collapseArrow = hasSubtasks ? `<span class="collapse-arrow ${isCollapsed ? 'collapsed' : ''}" onclick="toggleSubtaskCollapse(${todo.id})">▼</span>` : '';
    
    // Format and display date if it exists
    const dateDisplay = todo.dueDate ? `<span class="task-date">${formatDate(todo.dueDate)}</span>` : '';
    
    mainTaskDiv.innerHTML = `
        <div class="checkbox ${todo.completed ? 'checked' : ''}" 
             onclick="toggleMainTask(${todo.id})"></div>
        <span class="task-text">${escapeHtml(todo.text)}</span>
        <div class="task-controls">
            ${dateDisplay}
            ${subtaskCountDisplay}
            ${collapseArrow}
        </div>
    `;

    // Update interaction model: double-click for rename, right-click for date
    const taskTextSpan = mainTaskDiv.querySelector('.task-text');
    taskTextSpan.ondblclick = (e) => {
        e.preventDefault();
        showRenameTaskInput(todo.id, taskTextSpan);
    };
    
    taskTextSpan.oncontextmenu = (e) => {
        e.preventDefault();
        createDatePicker(todo.id, todo.dueDate);
    };
    
    todoDiv.appendChild(mainTaskDiv);
    
    // Subtasks section (only show if not collapsed and has subtasks or not completed)
    if ((todo.subtasks.length > 0 || !todo.completed) && !isCollapsed) {
        const subtasksDiv = document.createElement('div');
        subtasksDiv.className = 'subtasks';
        
        todo.subtasks.forEach(subtask => {
            const subtaskDiv = document.createElement('div');
            // Add .completed class to subtaskDiv if subtask is completed
            subtaskDiv.className = `subtask ${subtask.completed ? 'completed' : ''}`;
            subtaskDiv.innerHTML = `
                <div class="checkbox ${subtask.completed ? 'checked' : ''}" 
                     onclick="toggleSubtask(${todo.id}, ${subtask.id})"></div>
                <span class="task-text ${subtask.completed ? 'completed' : ''}">${escapeHtml(subtask.text)}</span>
                <button class="delete-btn" onclick="deleteSubtask(${todo.id}, ${subtask.id})">×</button>
            `;
            subtasksDiv.appendChild(subtaskDiv);
        });
        
        if (!todo.completed) {
            const addSubtaskDiv = document.createElement('div');
            addSubtaskDiv.className = 'add-subtask';
            addSubtaskDiv.innerHTML = `
                <input type="text" 
                       id="subtask-input-${todo.id}" 
                       class="subtask-input" 
                       placeholder="Add subtask..."
                       onkeypress="if(event.key==='Enter') addSubtask(${todo.id})">
            `;
            subtasksDiv.appendChild(addSubtaskDiv);
        }
        
        todoDiv.appendChild(subtasksDiv);
    }
    
    return todoDiv;
}

function updateTaskCount() {
    // Filter todos by current workspace
    const workspaceTodos = todos.filter(todo => todo.workspaceId === currentWorkspaceId);
    const totalTasks = workspaceTodos.length;
    const activeTasks = workspaceTodos.filter(t => !t.completed).length;
    const completedTasks = workspaceTodos.filter(t => t.completed).length;
    
    const countElement = document.getElementById('taskCount');
    
    if (totalTasks === 0) {
        countElement.textContent = 'No tasks';
    } else if (activeTasks === 0) {
        countElement.textContent = 'All completed';
    } else {
        countElement.textContent = `${activeTasks} active`;
        if (completedTasks > 0) {
            countElement.textContent += ` • ${completedTasks} finished`;
        }
    }
    
    // Update icon badge
    updateIconBadge();
}

function toggleFinishedSection() {
    showFinished = !showFinished;
    renderTodos();
}

function clearFinishedTasks() {
    const workspaceTodos = todos.filter(todo => todo.workspaceId === currentWorkspaceId);
    const completedCount = workspaceTodos.filter(todo => todo.completed).length;
    if (completedCount === 0) return;
    
    if (confirm(`Clear ${completedCount} finished task${completedCount > 1 ? 's' : ''}?`)) {
        todos = todos.filter(todo => !(todo.workspaceId === currentWorkspaceId && todo.completed));
        showFinished = false;
        renderTodos();
        updateTaskCount();
        saveData();
    }
}

function closeApp() {
    window.close();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function saveData() {
    const data = {
        todos: todos,
        workspaces: workspaces
    };
    await ipcRenderer.invoke('save-data', data);
}

// Handle escape key to close the app
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel.style.display !== 'none') {
            // Close settings panel if open
            toggleSettings();
        } else {
            // Close the app
            quitApp();
        }
    }
});

function showRenameTaskInput(taskId, taskTextSpan) {
    const currentText = taskTextSpan.textContent;
    taskTextSpan.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-rename-input';
    input.value = currentText;
    input.style.cssText = `
        background: rgba(35, 35, 35, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: #e0e0e0;
        outline: none;
        font-size: 14px;
        padding: 2px 6px;
        flex: 1;
        margin: 0 4px;
    `;

    taskTextSpan.parentNode.insertBefore(input, taskTextSpan);
    input.focus();
    input.select();

    const handleRename = () => {
        const newText = input.value.trim();
        taskTextSpan.style.display = 'inline';

        if (newText && newText !== currentText) {
            const todo = todos.find(t => t.id === taskId);
            if (todo) {
                todo.text = newText;
                saveData();
                taskTextSpan.textContent = escapeHtml(newText);
            }
        }
        input.remove();
    };

    input.addEventListener('blur', handleRename);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            taskTextSpan.style.display = 'inline';
            input.remove();
        }
    });
}

// Function to get count of pending subtasks for a task
function getPendingSubtasksCount(todo) {
    if (!todo.subtasks || todo.subtasks.length === 0) {
        return 0;
    }
    return todo.subtasks.filter(subtask => !subtask.completed).length;
}

// Function to get total pending tasks count based on settings
function getTotalPendingTasksCount() {
    let targetTodos = todos;
    
    if (iconBadgeScope === 'workspace') {
        targetTodos = todos.filter(todo => todo.workspaceId === currentWorkspaceId);
    }
    
    const pendingTasks = targetTodos.filter(todo => !todo.completed).length;
    const pendingSubtasks = targetTodos
        .filter(todo => !todo.completed)
        .reduce((total, todo) => total + getPendingSubtasksCount(todo), 0);
    
    return {
        tasks: pendingTasks,
        subtasks: pendingSubtasks,
        total: pendingTasks + pendingSubtasks
    };
}

// Function to update app icon with badge
async function updateIconBadge() {
    if (!iconBadgeEnabled || iconBadgeContent === 'none') {
        await ipcRenderer.invoke('update-icon-badge', null);
        return;
    }
    
    const counts = getTotalPendingTasksCount();
    let badgeText = null;
    
    switch (iconBadgeContent) {
        case 'tasks':
            badgeText = counts.tasks > 0 ? counts.tasks.toString() : null;
            break;
        case 'subtasks':
            badgeText = counts.subtasks > 0 ? counts.subtasks.toString() : null;
            break;
        case 'both':
            badgeText = counts.total > 0 ? counts.total.toString() : null;
            break;
        case 'separate':
            badgeText = counts.total > 0 ? `    ${counts.tasks} | ${counts.subtasks}` : null;
            break;
        default:
            badgeText = null;
    }
    
    await ipcRenderer.invoke('update-icon-badge', badgeText);
}

function updateIconBadgeSettingsUI() {
    const enabledCheckbox = document.getElementById('iconBadgeEnabled');
    const contentSelect = document.getElementById('iconBadgeContent');
    const scopeSelect = document.getElementById('iconBadgeScope');
    const dateFormatSelect = document.getElementById('dateFormat');
    
    if (enabledCheckbox) {
        enabledCheckbox.checked = iconBadgeEnabled;
    }
    
    if (contentSelect) {
        contentSelect.value = iconBadgeContent;
    }
    
    if (scopeSelect) {
        scopeSelect.value = iconBadgeScope;
    }
    
    if (dateFormatSelect) {
        dateFormatSelect.value = dateFormat;
    }
}

// Function to handle date format setting changes
function changeDateFormat(format) {
    dateFormat = format;
    renderTodos(); // Re-render to update date displays
    saveSettings();
}

function createDatePicker(taskId, currentDate) {
    // Remove existing date picker if any
    const existingPicker = document.getElementById('datePicker');
    if (existingPicker) {
        existingPicker.remove();
    }
    
    const picker = document.createElement('div');
    picker.id = 'datePicker';
    picker.className = 'date-picker-overlay';
    
    const today = new Date();
    const selectedDate = currentDate ? new Date(currentDate) : today;
    
    picker.innerHTML = `
        <div class="date-picker-modal">
            <div class="date-picker-header">
                <span>Select Date</span>
                <button class="date-picker-close" onclick="closeDatePicker()">×</button>
            </div>
            <div class="date-picker-content">
                <div class="date-picker-month-nav">
                    <button onclick="previousMonth()">&lt;</button>
                    <span id="monthYear"></span>
                    <button onclick="nextMonth()">&gt;</button>
                </div>
                <div class="date-picker-calendar" id="calendar"></div>
                <div class="date-picker-actions">
                    <button onclick="clearDate()">Clear Date</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(picker);
    currentDatePickerTaskId = taskId;
    
    // Initialize calendar
    window.currentPickerDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    window.selectedPickerDate = currentDate ? new Date(currentDate) : null;
    
    renderCalendar();
    
    // Focus on the picker
    picker.focus();
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthYear = document.getElementById('monthYear');
    
    if (!calendar || !monthYear || !window.currentPickerDate) return;
    
    const year = window.currentPickerDate.getFullYear();
    const month = window.currentPickerDate.getMonth();
    
    monthYear.textContent = window.currentPickerDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Clear calendar
    calendar.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendar.appendChild(emptyDay);
    }
    
    // Add days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const currentDate = new Date(year, month, day);
        
        // Check if this is today
        if (currentDate.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // Check if this is the selected date
        if (window.selectedPickerDate && 
            currentDate.toDateString() === window.selectedPickerDate.toDateString()) {
            dayElement.classList.add('selected');
        }
        
        dayElement.onclick = () => selectDate(year, month, day);
        calendar.appendChild(dayElement);
    }
}

function previousMonth() {
    if (!window.currentPickerDate) return;
    window.currentPickerDate.setMonth(window.currentPickerDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    if (!window.currentPickerDate) return;
    window.currentPickerDate.setMonth(window.currentPickerDate.getMonth() + 1);
    renderCalendar();
}

function selectDate(year, month, day) {
    const selectedDate = new Date(year, month, day);
    window.selectedPickerDate = selectedDate;
    renderCalendar();
    
    // Apply the date to the task
    if (currentDatePickerTaskId) {
        const todo = todos.find(t => t.id === currentDatePickerTaskId);
        if (todo) {
            todo.dueDate = selectedDate.toISOString();
            saveData();
            renderTodos();
        }
    }
    
    closeDatePicker();
}

function selectToday() {
    const today = new Date();
    selectDate(today.getFullYear(), today.getMonth(), today.getDate());
}

function selectTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    selectDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
}

function clearDate() {
    if (currentDatePickerTaskId) {
        const todo = todos.find(t => t.id === currentDatePickerTaskId);
        if (todo) {
            delete todo.dueDate;
            saveData();
            renderTodos();
        }
    }
    closeDatePicker();
}

function closeDatePicker() {
    const picker = document.getElementById('datePicker');
    if (picker) {
        picker.remove();
    }
    currentDatePickerTaskId = null;
    window.currentPickerDate = null;
    window.selectedPickerDate = null;
}

// Functions to handle icon badge settings changes
function toggleIconBadge() {
    iconBadgeEnabled = !iconBadgeEnabled;
    updateIconBadgeSettingsUI();
    updateIconBadge();
    saveSettings();
}

function changeIconBadgeContent(content) {
    iconBadgeContent = content;
    updateIconBadgeSettingsUI();
    updateIconBadge();
    saveSettings();
}

function changeIconBadgeScope(scope) {
    iconBadgeScope = scope;
    updateIconBadgeSettingsUI();
    updateIconBadge();
    saveSettings();
}

// Date formatting functions
function formatDate(dateString, format = dateFormat) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Reset time to midnight for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (format) {
        case 'relative':
            return formatRelativeDate(date, diffDays);
        case 'dmy':
            return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        case 'mdy':
            return date.toLocaleDateString('en-US'); // MM/DD/YYYY
        case 'monthday':
            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); // "May 3"
        default:
            return formatRelativeDate(date, diffDays);
    }
}

function formatRelativeDate(date, diffDays) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Tomorrow';
    } else if (diffDays === -1) {
        return 'Yesterday';
    } else if (diffDays > 1 && diffDays <= 7) {
        return `${dayName}`;
    } else if (diffDays > 7 && diffDays <= 14) {
        return `Next ${dayName}`;
    } else if (diffDays < -1 && diffDays >= -7) {
        return `Last ${dayName}`;
    } else if (diffDays > 14) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Update functionality
let updateInfo = null;

async function initializeUpdateUI() {
    try {
        const version = await ipcRenderer.invoke('get-app-version');
        const versionElement = document.getElementById('currentVersion');
        if (versionElement) {
            versionElement.textContent = `Version: ${version}`;
        }
    } catch (error) {
        console.error('Error getting app version:', error);
    }
}

async function checkForUpdates() {
    const checkBtn = document.getElementById('updateCheckBtn');
    const statusElement = document.getElementById('updateStatus');
    const actionsElement = document.getElementById('updateActions');
    
    try {
        // Disable button and show checking status
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
        statusElement.textContent = 'Checking for updates...';
        statusElement.className = 'update-status checking';
        actionsElement.style.display = 'none';
        
        const result = await ipcRenderer.invoke('check-for-updates');
        console.log('Update check result:', result);
        
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Again';
        
    } catch (error) {
        console.error('Error checking for updates:', error);
        statusElement.textContent = `Error checking for updates: ${error.message}`;
        statusElement.className = 'update-status error';
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check for Updates';
    }
}

async function downloadUpdate() {
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    const statusElement = document.getElementById('updateStatus');
    const progressElement = document.getElementById('updateProgress');
    
    try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
        statusElement.textContent = 'Downloading update...';
        progressElement.style.display = 'block';
        
        await ipcRenderer.invoke('download-update');
        
    } catch (error) {
        console.error('Error downloading update:', error);
        statusElement.textContent = `Error downloading update: ${error.message}`;
        statusElement.className = 'update-status error';
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download Update';
        progressElement.style.display = 'none';
    }
}

async function installUpdate() {
    const installBtn = document.getElementById('installUpdateBtn');
    const statusElement = document.getElementById('updateStatus');
    
    try {
        installBtn.disabled = true;
        installBtn.textContent = 'Installing...';
        statusElement.textContent = 'Installing update and restarting...';
        
        // This will quit and install the update, then restart
        await ipcRenderer.invoke('install-update');
        
    } catch (error) {
        console.error('Error installing update:', error);
        statusElement.textContent = `Error installing update: ${error.message}`;
        statusElement.className = 'update-status error';
        installBtn.disabled = false;
        installBtn.textContent = 'Install & Restart';
    }
}

// Listen for update status from main process
ipcRenderer.on('update-status', (event, data) => {
    const statusElement = document.getElementById('updateStatus');
    const actionsElement = document.getElementById('updateActions');
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    const installBtn = document.getElementById('installUpdateBtn');
    const progressElement = document.getElementById('updateProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    console.log('Update status:', data);
    
    switch (data.type) {
        case 'checking':
            statusElement.textContent = 'Checking for updates...';
            statusElement.className = 'update-status checking';
            actionsElement.style.display = 'none';
            progressElement.style.display = 'none';
            break;
            
        case 'available':
            statusElement.textContent = `Update available: v${data.version}`;
            statusElement.className = 'update-status available';
            actionsElement.style.display = 'block';
            downloadBtn.style.display = 'block';
            installBtn.style.display = 'none';
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download Update';
            break;
            
        case 'not-available':
            statusElement.textContent = `You're running the latest version`;
            statusElement.className = 'update-status not-available';
            actionsElement.style.display = 'none';
            progressElement.style.display = 'none';
            break;
            
        case 'download-progress':
            const percent = Math.round(data.percent);
            progressFill.style.width = percent + '%';
            progressText.textContent = `${percent}% (${formatBytes(data.transferred)} / ${formatBytes(data.total)})`;
            break;
            
        case 'downloaded':
            statusElement.textContent = `Update downloaded. Ready to install v${data.version}`;
            statusElement.className = 'update-status available';
            downloadBtn.style.display = 'none';
            installBtn.style.display = 'block';
            installBtn.disabled = false;
            installBtn.textContent = 'Install & Restart';
            progressElement.style.display = 'none';
            break;
            
        case 'error':
            statusElement.textContent = `Error: ${data.error}`;
            statusElement.className = 'update-status error';
            actionsElement.style.display = 'none';
            progressElement.style.display = 'none';
            break;
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
} 