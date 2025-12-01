# 🌐 TimeShift Web Analyzer

Analyze how a website changes over time using archived snapshots from the Wayback Machine.

---

## 📸 Screenshots

### Homepage
![Homepage](screenshots/home.png)

### Results Page
![Results](screenshots/results.png)

### Charts & Analysis
![Charts](screenshots/charts.png)

---

## ✅ What This Project Does

TimeShift Web Analyzer takes a website link and a year, then:

- Fetches archived versions from the Internet Archive
- Compares content across all snapshots
- Detects when the page changed
- Calculates how often changes happened
- Displays results clearly

This helps users track how websites evolve over time.

---

## 🧰 Tech Stack

- Go (Backend)
- Redis (Queue & Cache)
- Chart.js (Frontend Charts)
- HTML, CSS, JavaScript
- Wayback Machine API
- Docker

---

## 🚀 How to Run Project

### Requirements
- Go installed
- Docker installed
- Git installed

### Run Redis
```bash
docker compose up -d
