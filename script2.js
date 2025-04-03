document.addEventListener('DOMContentLoaded', function () {
    // Find the HTML IDs
    const eventForm = document.getElementById('eventForm');
    const eventsTableBody = document.getElementById('eventsTableBody');
    const calendarEl = document.getElementById('calendar');
    const timeLogForm = document.getElementById('timeLogForm');
    const timeLogHistory = document.getElementById('timeLogHistory');

    // Grab data from localStorage and initialize the arrays
    let events = JSON.parse(localStorage.getItem('events')) || [];
    let timeLogs = JSON.parse(localStorage.getItem('timeLogs')) || {};

    // Implements the calendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridWeek',
        events: events.map(e => ({ title: e.event, start: e.dateTime })),
    });
    window.calendar = calendar;
    calendar.render();
    reloadCalendarEvents();

    eventForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get form values
        const eventInput = document.getElementById('eventInput').value;
        const dateInput = document.getElementById('dateInput').value;
        const timeInput = document.getElementById('timeInput').value;
        const priorityInput = document.getElementById('priorityInput').value;

        // Combine date and time
        const dateTime = new Date(`${dateInput}T${timeInput}`);

        // Format date as day/month/year
        const formattedDate = dateTime.toLocaleDateString('en-GB');

        // Add event to the array
        events.push({ event: eventInput, date: formattedDate, time: timeInput, dateTime });

        // Sort events by dateTime
        events.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // Add events to localStorage
        localStorage.setItem('events', JSON.stringify(events));

        // Update the table
        updateTable();

        // Add event to the calendar
        addEventToCalendar(eventInput, dateInput, timeInput);

        // Reload calendar events
        reloadCalendarEvents();

        // Update missed events
        updateMissedEvents();

        // Re-render the calendar
        calendar.render();

        // Reset the form
        eventForm.reset();

        // Save events to the API
        saveEventsToAPI();

        // Generate time plan
        generateTimePlan();
    });

    // Add functionality to time log submit button
    timeLogForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get the form values
        const activityInput = document.getElementById('activityInput').value;
        const hoursInput = document.getElementById('hoursInput').value || 0;
        const minutesInput = document.getElementById('minutesInput').value || 0;

        // Allow only hours or minutes to be input
        if (hoursInput == 0 && minutesInput == 0) return;

        // Convert to UK format
        const duration = `${hoursInput}h ${minutesInput}m`;
        const today = new Date().toLocaleDateString('en-GB');

        // Set a new time log for today
        if (!timeLogs[today]) timeLogs[today] = [];
        timeLogs[today].push({ activity: activityInput, duration });

        // Add new time logs to localStorage
        localStorage.setItem('timeLogs', JSON.stringify(timeLogs));

        // Update the time logs table
        updateTimeLogHistory();
        timeLogForm.reset();
    });

    function updateTable() {
        // Clear the table body
        eventsTableBody.innerHTML = '';

        // Add sorted events to the table
        events.forEach(({ event, date, time, priority }, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event}</td>
                <td>${date}</td>
                <td>${time}</td>
                <td>
                    <select class="form-select priority-dropdown" data-index="${index}">
                        <option value="Low" ${priority === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Medium" ${priority === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="High" ${priority === 'High' ? 'selected' : ''}>High</option>
                    </select>
                </td>
                <td><button class="btn btn-sm btn-danger" onclick="completeEvent(${index})">Complete</button></td>
            `;
            eventsTableBody.appendChild(row);
        });
    
        // Attach event listeners to priority dropdowns
        document.querySelectorAll('.priority-dropdown').forEach(dropdown => {
            dropdown.addEventListener('change', function () {
                const index = this.dataset.index;
                events[index].priority = this.value;
                localStorage.setItem('events', JSON.stringify(events));
                generateTimePlan(); // Update time plan after priority change
            });
        });
    }
    updateTable();


    // Add an event to the calendar
    function addEventToCalendar(eventTitle, eventDate, eventTime) {
        const eventDateTime = `${eventDate}T${eventTime}`;
        calendar.addEvent({
            title: eventTitle,
            start: eventDateTime
        });
    }

    // Reload the calendar to update as events are added
    function reloadCalendarEvents() {
        calendar.removeAllEvents(); // Clear old events
        calendar.addEventSource(events.map(({ event, dateTime }) => ({
            title: event,
            start: dateTime
        })));
    }

    // Checks for upcoming deadlines to notify the user
    function checkDeadlines() {
        const now = new Date();
        events.forEach(({ event, dateTime }) => {
            const timeDifference = new Date(dateTime) - now;
            if (timeDifference > 0 && timeDifference <= 30 * 60 * 1000) { // 30 minutes
                showNotification(event);
            }
        });
    }

    // Creates the notification and displays it
    function showNotification(eventName) {
        const notification = document.createElement('div');
        notification.classList.add('alert', 'alert-warning', 'position-fixed', 'top-0', 'end-0', 'm-3');
        notification.innerHTML = `<strong>Reminder:</strong> This deadline: ${eventName} is coming up soon!`;
        document.body.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    }

    // Check deadlines every minute
    setInterval(checkDeadlines, 60 * 1000);

    // Allow the user to complete events and remove them from the table
    window.completeEvent = function (index) {
        const eventToRemove = events[index];
        events.splice(index, 1);
        localStorage.setItem('events', JSON.stringify(events));

        // Remove from FullCalendar
        let eventObj = calendar.getEvents().find(e => e.title === eventToRemove.event && new Date(e.start).toISOString() === eventToRemove.dateTime);
        if (eventObj) eventObj.remove();

        // Update everything
        reloadCalendarEvents();
        updateTable();
        updateMissedEvents();
        saveEventsToAPI();
        calendar.render();
        generateTimePlan();
    };

    // Save events to the API for Alexa
    async function saveEventsToAPI() {
        const jsonData = JSON.stringify(events, null, 2);
        try {
            const response = await fetch('https://deadlines-bot.tobypob.workers.dev/api/store-events', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: jsonData
            });
            const result = await response.text();
            console.log('Server Response:', result);
        } catch (error) {
            console.error('Error saving events:', error);
        }
    }

    // Update the time logs table as it gets added to
    function updateTimeLogHistory() {
        timeLogHistory.innerHTML = '';
        Object.keys(timeLogs).forEach(date => {
            timeLogs[date].forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${date}</td><td>${log.activity}</td><td>${log.duration}</td>`;
                timeLogHistory.appendChild(row);
            });
        });
    }
    updateTimeLogHistory();

    function updateMissedEvents() {
        //Get today's date and filter missed events
        const now = new Date();
        const missedEvents = events.filter(({ dateTime }) => new Date(dateTime) < now);

        // Identify the HTML IDs
        const missedEventsContainer = document.getElementById('missedEventsContainer');
        const missedEventsTableBody = document.getElementById('missedEventsTableBody');

        // Clear the table
        missedEventsTableBody.innerHTML = '';

        // Display the table and populate it if there are missed events
        if (missedEvents.length > 0) {
            missedEventsContainer.style.display = 'block';
            missedEvents.forEach(({ event, date, time }) => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${event}</td><td>${date}</td><td>${time}</td>`;
                missedEventsTableBody.appendChild(row);
            });
        } else {
            missedEventsContainer.style.display = 'none';
        }
    }

    // Create a timeplan for the user
    function generateTimePlan() {
        timePlanContainer.innerHTML = ''; // Clear previous schedule
    
        timePlanContainer.innerHTML = ''; // Clear previous schedule
        const now = new Date();
        const startHour = 9;  // Start workday at 9 AM
        const endHour = 17;   // End workday at 5 PM
        const workHours = endHour - startHour;
        
        let availableTime = workHours * 60; // Total available minutes
        let schedule = [];
        let currentTime = new Date();
        currentTime.setHours(startHour, 0, 0, 0); // Set start of the workday
    
        // Sort events by upcoming deadlines
        let sortedEvents = events.filter(e => new Date(e.dateTime) >= now);
        sortedEvents.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
        // Assign tasks to time slots
        for (let event of sortedEvents) {
            if (availableTime <= 0) break;
    
            let taskDuration = 90; // Default task duration: 1.5 hours
            if (availableTime < taskDuration) taskDuration = availableTime;
    
            let endTime = new Date(currentTime.getTime() + taskDuration * 60000);
    
            schedule.push({
                title: event.event,
                startTime: formatTime(currentTime),
                endTime: formatTime(endTime)
            });
    
            availableTime -= taskDuration;
            currentTime = new Date(endTime);
    
            // Add breaks after every 1.5-hour block
            if (availableTime >= 15) {
                schedule.push({
                    title: "Break",
                    startTime: formatTime(currentTime),
                    endTime: formatTime(new Date(currentTime.getTime() + 15 * 60000))
                });
                availableTime -= 15;
                currentTime.setMinutes(currentTime.getMinutes() + 15);
            }
        }
    
        // Generate UI
        if (schedule.length === 0) {
            timePlanContainer.innerHTML = '<p class="text-muted">No tasks scheduled for today.</p>';
            return;
        }
    
        schedule.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.classList.add('time-block');
            taskElement.innerHTML = `<strong>${task.startTime} - ${task.endTime}</strong>: ${task.title}`;
            timePlanContainer.appendChild(taskElement);
        });
    }
    
    // Format time to HH:MM AM/PM
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Load events when the page loads
    window.onload = async function () {
        events = JSON.parse(localStorage.getItem('events')) || [];
        missedEvents = JSON.parse(localStorage.getItem('missedEvents')) || [];
    
        calendar.removeAllEvents(); // Clear old events
    
        events.forEach(({ event, date, time }) => {
            addEventToCalendar(event, date, time);
        });
    
        reloadCalendarEvents();
        updateTable();
        updateMissedEvents();
        generateTimePlan();
        saveEventsToAPI();
        calendar.render();
    };
});
