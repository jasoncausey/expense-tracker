# Expense Tracker PWA

A Progressive Web Application (PWA) for tracking personal expenses, and generating reports offline.

## Features

### Core Functionality

- **Expense Tracking**: Add, view, and delete individual expenses with custom labels and amounts.
    *  Uses the current date for new expenses by default, or you can set a custom date.
    * Quickly select common expense categories with pre-defined labels.
- **Report Management**: Close expense periods and generate a printable report.
    *  View and print previously generated expense reports.
- **Data Export/Import**: Export and import data as CSV files for backup or transfer across devices.

### PWA Capabilities

- **Offline Support**: Full functionality without an internet connection.
- **Installable**: Can be installed on devices as a standalone application.
- **Responsive Design**: Works on mobile, tablet, and desktop devices.
- **Local Storage**: All data is stored securely on your device using IndexedDB.

## User Guide

### Adding Expenses

1. Enter the expense amount in the "Amount" field.
2. Optionally click the calendar icon to set a custom date.
3. Enter a label or select a quick label from the options.
4. Click "Add Expense".

### Managing Expenses

- View all current expenses in the "Current Expenses" section.
- Delete individual expenses by clicking the "Delete" button.
- See the running total of all current expenses at the bottom.

### Generating Reports

1. Click "Close Period & Generate Report" when you want to finalize a set of expenses.
2. Review the generated report.
3. Print the report if needed by clicking "Print Report".
4. Return to the main view to start a new expense period.

### Viewing Historical Reports

- All previously generated reports appear in the "Historical Reports" section.
- Click "View" on any report to see its details.
- Print historical reports as needed.

### Data Management

Access settings by clicking the gear icon in the header:

- **Export Data**: Download all expense data as a CSV file.
- **Import Data**: Upload previously exported CSV data.
- **Delete All Data**: Clear all expenses and reports to start fresh.

## Installation

As a PWA, this application can be installed on your device:

1. Open the application in a supported browser.
2. For mobile devices, tap the "Add to Home Screen" option in your browser menu.
3. For desktop, look for the install icon in your browser's address bar.

## Technical Details

### Architecture

The application is built using vanilla JavaScript with a focus on progressive enhancement and offline-first functionality. It uses:

- **IndexedDB**: For client-side data storage.
- **Service Worker**: For offline caching and PWA functionality.
- **Responsive CSS**: For a mobile-friendly interface.

## Privacy

All data is stored locally on your device. No data is sent to any server.

## Released under MIT License

Copyright (c) 2025 Jason L. Causey.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
