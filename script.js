// API Configuration
const API_BASE_URL = 'http://localhost:8096';

// Global variables
let currentJobId = null;
let currentUrl = null;
let currentYear = null;
let resultsData = [];
let pollingInterval = null;
let timelineChart = null;

// Form submission
document.getElementById('calculatorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let url = document.getElementById('url').value.trim();
    const year = document.getElementById('year').value.trim();
    
    // Clean URL - remove protocol and www
    url = url.replace(/^https?:\/\//i, '');  // Remove http:// or https://
    url = url.replace(/^www\./i, '');        // Remove www.
    url = url.replace(/\/+$/, '');           // Remove trailing slashes
    
    currentUrl = url;
    currentYear = year;
    
    await startCalculation(url, year);
});

// Start calculation
async function startCalculation(url, year) {
    try {
        // Update UI
        document.getElementById('submitText').style.display = 'none';
        document.getElementById('submitLoader').style.display = 'inline-block';
        document.getElementById('calculatorForm').querySelector('button').disabled = true;
        
        // Hide previous results/errors
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}/calculate-simhash?url=${encodeURIComponent(url)}&year=${year}`);
        const data = await response.json();
        
        if (data.status === 'started' && data.job_id) {
            currentJobId = data.job_id;
            
            // Show status section
            document.getElementById('statusSection').style.display = 'block';
            document.getElementById('jobId').textContent = data.job_id;
            document.getElementById('jobStatus').textContent = 'PENDING';
            document.getElementById('jobStatus').className = 'status-badge pending';
            
            // Start polling for job status
            startPolling();
        } else {
            showError('Failed to start calculation. Please try again.');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to connect to the server. Make sure the Go application is running.');
    } finally {
        // Reset button
        document.getElementById('submitText').style.display = 'inline';
        document.getElementById('submitLoader').style.display = 'none';
        document.getElementById('calculatorForm').querySelector('button').disabled = false;
    }
}

// Poll job status
function startPolling() {
    let progress = 0;
    
    // Simulate progress
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            updateProgressBar(Math.min(progress, 90));
        }
    }, 1000);
    
    // Poll actual status
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/job?job_id=${currentJobId}`);
            const data = await response.json();
            
            document.getElementById('jobStatus').textContent = data.status;
            
            if (data.status === 'SUCCESS') {
                clearInterval(pollingInterval);
                clearInterval(progressInterval);
                updateProgressBar(100);
                
                document.getElementById('jobStatus').className = 'status-badge success';
                document.getElementById('jobDuration').textContent = data.duration || 'Completed';
                document.getElementById('statusMessage').textContent = 'Calculation complete! Loading results...';
                
                // Fetch results
                setTimeout(() => fetchResults(), 1000);
                
            } else if (data.status === 'FAILURE' || data.status === 'error') {
                clearInterval(pollingInterval);
                clearInterval(progressInterval);
                document.getElementById('jobStatus').className = 'status-badge error';
                showError('Job failed. The website may not have enough archived snapshots.');
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

// Update progress bar
function updateProgressBar(percentage) {
    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = percentage + '%';
}

// Fetch results
async function fetchResults() {
    try {
        console.log('Fetching results for:', currentUrl, currentYear);
        const response = await fetch(`${API_BASE_URL}/simhash?url=${encodeURIComponent(currentUrl)}&year=${currentYear}`);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        console.log('Data type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        
        // Check if response has error status (object format)
        if (data.status === 'error' || data.status === 'ERROR') {
            console.error('API returned error:', data.info);
            showError(data.info || 'No captures found for this website and year.');
            return;
        }
        
        let captures = null;
        
        // Log raw response for debugging
        console.log('Raw response type:', typeof data);
        console.log('Is array?', Array.isArray(data));
        if (Array.isArray(data)) {
            console.log('Array length:', data.length);
            console.log('First element type:', typeof data[0]);
            console.log('First element is array?', Array.isArray(data[0]));
            if (data.length > 0 && Array.isArray(data[0])) {
                console.log('First capture sample:', data[0].slice(0, 2));
            }
        }
        
        // Backend returns captures array directly: [[timestamp, simhash], ...]
        // Each capture is a 2-element array: [timestamp_string, simhash_string]
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].length === 2) {
            console.log('Detected direct captures array format');
            captures = data;
            console.log('Captures count:', captures.length);
            console.log('Sample capture:', captures[0]);
        }
        // Backend returns object format: {captures: [...], totalCaptures: n, status: "..."}
        else if (data.captures && Array.isArray(data.captures)) {
            console.log('Detected object format response');
            captures = data.captures;
            console.log('Captures count:', captures.length);
        }
        
        // Display results if we have captures
        if (captures && Array.isArray(captures) && captures.length > 0) {
            console.log('Displaying', captures.length, 'captures');
            console.log('First 3 captures:', captures.slice(0, 3));
            resultsData = captures;
            displayResults(captures);
            
            // Hide status section
            document.getElementById('statusSection').style.display = 'none';
        } else {
            console.log('No captures found in response');
            console.log('Data structure:', JSON.stringify(data).substring(0, 200));
            showError('No snapshots found for this website and year.');
        }
        
    } catch (error) {
        console.error('Error fetching results:', error);
        showError('Failed to fetch results. Please try again.');
    }
}

// Display results
function displayResults(captures) {
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Calculate statistics
    const uniqueSimhashes = new Set(captures.map(c => c[1]));
    const totalSnapshots = captures.length;
    const uniqueVersions = uniqueSimhashes.size;
    const changeFrequency = ((uniqueVersions / totalSnapshots) * 100).toFixed(1);
    
    // Get date range
    const firstDate = formatDate(captures[0][0]);
    const lastDate = formatDate(captures[captures.length - 1][0]);
    
    // Update statistics
    document.getElementById('totalSnapshots').textContent = totalSnapshots;
    document.getElementById('uniqueVersions').textContent = uniqueVersions;
    document.getElementById('changeFrequency').textContent = changeFrequency + '%';
    document.getElementById('dateRange').textContent = `${firstDate} - ${lastDate}`;
    
    // Create timeline chart
    createTimelineChart(captures);
    
    // Populate table
    populateTable(captures);
}

// Create timeline chart
function createTimelineChart(captures) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Destroy existing chart if any
    if (timelineChart) {
        timelineChart.destroy();
    }
    
    // Group by month
    const monthlyData = {};
    const monthlyChanges = {};
    
    captures.forEach((capture, index) => {
        const timestamp = capture[0];
        const simhash = capture[1];
        const month = timestamp.substring(0, 6); // YYYYMM
        
        if (!monthlyData[month]) {
            monthlyData[month] = 0;
            monthlyChanges[month] = 0;
        }
        monthlyData[month]++;
        
        // Check if content changed
        if (index > 0 && captures[index - 1][1] !== simhash) {
            monthlyChanges[month]++;
        }
    });
    
    const labels = Object.keys(monthlyData).map(month => {
        return `${month.substring(0, 4)}-${month.substring(4, 6)}`;
    });
    
    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Snapshots',
                    data: Object.values(monthlyData),
                    backgroundColor: 'rgba(102, 126, 234, 0.5)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Content Changes',
                    data: Object.values(monthlyChanges),
                    backgroundColor: 'rgba(255, 193, 7, 0.5)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Populate table
function populateTable(captures) {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
    
    let previousSimhash = null;
    
    captures.forEach((capture, index) => {
        const timestamp = capture[0];
        const simhash = capture[1];
        const dateTime = formatDateTime(timestamp);
        const changed = previousSimhash && previousSimhash !== simhash;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${timestamp}</td>
            <td>${dateTime}</td>
            <td class="simhash-cell" title="${simhash}">${simhash}</td>
            <td>
                <span class="change-indicator ${changed ? 'changed' : 'same'}"></span>
                ${changed ? 'Changed' : 'Same'}
            </td>
            <td>
                <a href="https://web.archive.org/web/${timestamp}/${currentUrl}" 
                   target="_blank" 
                   class="link-btn">
                    View
                </a>
            </td>
        `;
        
        tbody.appendChild(row);
        previousSimhash = simhash;
    });
}

// Format date (YYYYMMDD to readable format)
function formatDate(timestamp) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    return `${year}-${month}-${day}`;
}

// Format date and time
function formatDateTime(timestamp) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// Export to CSV
function exportToCSV() {
    let csv = 'Timestamp,Date & Time,Simhash,Status\n';
    
    let previousSimhash = null;
    resultsData.forEach(capture => {
        const timestamp = capture[0];
        const simhash = capture[1];
        const dateTime = formatDateTime(timestamp);
        const status = previousSimhash && previousSimhash !== simhash ? 'Changed' : 'Same';
        
        csv += `${timestamp},"${dateTime}","${simhash}",${status}\n`;
        previousSimhash = simhash;
    });
    
    downloadFile(csv, `${currentUrl}-${currentYear}-results.csv`, 'text/csv');
}

// Export to JSON
function exportToJSON() {
    const jsonData = {
        url: currentUrl,
        year: currentYear,
        total_snapshots: resultsData.length,
        unique_versions: new Set(resultsData.map(c => c[1])).size,
        captures: resultsData.map((capture, index) => ({
            index: index + 1,
            timestamp: capture[0],
            datetime: formatDateTime(capture[0]),
            simhash: capture[1]
        }))
    };
    
    const json = JSON.stringify(jsonData, null, 2);
    downloadFile(json, `${currentUrl}-${currentYear}-results.json`, 'application/json');
}

// Download file helper
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Show error
function showError(message) {
    document.getElementById('statusSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
    
    // Clear polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
}

// Reset form
function resetForm() {
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('statusSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('calculatorForm').reset();
    currentJobId = null;
    currentUrl = null;
    currentYear = null;
    resultsData = [];
}
