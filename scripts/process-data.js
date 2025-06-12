const path = require('path');
const fs = require('fs').promises; // Use promises-based file system module
const axios = require('axios'); // For making HTTP requests
const { parse } = require('csv-parse'); // For parsing CSV
const { stringify } = require('csv-stringify'); // For stringifying CSV

// --- Configure logging ---
// Node.js doesn't have a built-in logging module exactly like Python's,
// but console.log, console.error, console.warn are common.
// For more advanced logging, consider libraries like 'winston' or 'pino'.
const logger = {
    info: (message) => console.log(`INFO: ${new Date().toISOString()} - ${message}`),
    warn: (message) => console.warn(`WARN: ${new Date().toISOString()} - ${message}`),
    error: (message) => console.error(`ERROR: ${new Date().toISOString()} - ${message}`),
};

// --- Constants ---
const CSV_PATH = path.join('src', 'data', 'history.csv');
const JSON_PATH = path.join('src', 'data', 'history.json');
const API_URL = "https://min-api.cryptocompare.com/data/v2/histoday";

/**
 * Fetches the opening price for a given day from the CryptoCompare API.
 * @param {number} dayTimestamp - Unix timestamp for the target day (at midnight UTC).
 * @param {string} apiKey - CryptoCompare API key.
 * @returns {Promise<number>} - The opening price.
 */
async function fetchPrice(dayTimestamp, apiKey) {
    const params = {
        fsym: 'BTC',
        tsym: 'USD',
        limit: 1,
        toTs: dayTimestamp,
        api_key: apiKey
    };

    try {
        const response = await axios.get(API_URL, { params, timeout: 10000 }); // 10 seconds timeout
        const data = response.data;

        if (data.Response !== 'Success' || !data.Data || !data.Data.Data || data.Data.Data.length === 0) {
            throw new Error(`API returned an invalid response for timestamp ${dayTimestamp}`);
        }

        for (const dayData of data.Data.Data) {
            if (dayData.time === dayTimestamp && typeof dayData.open === 'number') {
                return dayData.open;
            }
        }
        throw new Error(`Price data not found for timestamp ${dayTimestamp} in API response`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Network error while fetching data for ${new Date(dayTimestamp * 1000).toISOString().split('T')[0]}: ${error.message}`);
        }
        throw error; // Re-throw other errors
    }
}

/**
 * Main function to update the historical data.
 */
async function main() {
    logger.info("Starting data processing script...");

    // --- Step 1: Get API Key ---
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    if (!apiKey) {
        logger.error("FATAL: CRYPTOCOMPARE_API_KEY environment variable not set.");
        process.exit(1);
    }

    // --- Step 2: Load existing data ---
    let df = []; // Represents your data frame (array of objects)
    let lastDateInCsv = null;

    try {
        const csvContent = await fs.readFile(CSV_PATH, 'utf8');
        const records = await new Promise((resolve, reject) => {
            parse(csvContent, {
                columns: true, // Treat the first row as column headers
                skip_empty_lines: true
            }, (err, data) => {
                if (err) reject(err);
                resolve(data);
            });
        });

        // Convert date strings to Date objects and find the max date
        df = records.map(row => ({
            date: new Date(row.date), // Parse date string to Date object
            price: parseFloat(row.price)
        }));

        if (df.length > 0) {
            lastDateInCsv = new Date(Math.max(...df.map(row => row.date.getTime())));
            // Normalize to midnight
            lastDateInCsv.setUTCHours(0, 0, 0, 0);
        } else {
            logger.warn(`CSV file ${CSV_PATH} is empty. Starting from scratch.`);
            // If CSV is empty, start from a reasonable past date, e.g., 2010-01-01
            lastDateInCsv = new Date(Date.UTC(2010, 0, 1)); 
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`FATAL: The source file ${CSV_PATH} was not found.`);
        } else {
            logger.error(`FATAL: Failed to read or parse ${CSV_PATH}: ${error.message}`);
        }
        process.exit(1);
    }

    // --- Step 3: Determine which dates to update ---
    // Get yesterday's date in UTC (normalize to midnight)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    logger.info(`Last date in CSV: ${lastDateInCsv.toISOString().split('T')[0]}`);
    logger.info(`Target date (yesterday): ${yesterday.toISOString().split('T')[0]}`);

    let currentDate = new Date(lastDateInCsv);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Start from the day after the last recorded date
    currentDate.setUTCHours(0, 0, 0, 0);

    const new_data = [];

    // --- Step 4: Fetch new data from API ---
    while (currentDate.getTime() <= yesterday.getTime()) {
        const formattedDate = currentDate.toISOString().split('T')[0];
        logger.info(`Fetching data for ${formattedDate}...`);
        try {
            const timestamp = Math.floor(currentDate.getTime() / 1000); // Convert milliseconds to seconds
            const price = await fetchPrice(timestamp, apiKey);
            new_data.push({ date: new Date(currentDate), price: price });
        } catch (error) {
            logger.warning(`Could not get data for ${formattedDate}: ${error.message}`);
            // If there's a network error, stop fetching further data for now
            if (error.message.includes('Network error')) {
                 logger.error(`Stopping data fetching due to network error.`);
                 break;
            }
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // --- Step 5: Update CSV file ONLY if new data was fetched ---
    if (new_data.length > 0) {
        logger.info(`Adding ${new_data.length} new row(s) to the dataset.`);
        // Concatenate new data, ensuring dates are handled as Date objects
        df = df.concat(new_data);

        // Sort the data by date to ensure correct order
        df.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Format dates to YYYY-MM-DD for CSV
        const csvData = df.map(row => ({
            date: row.date.toISOString().split('T')[0],
            price: row.price
        }));

        try {
            const csvString = await new Promise((resolve, reject) => {
                stringify(csvData, { header: true }, (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            });
            await fs.writeFile(CSV_PATH, csvString);
            logger.info(`Successfully updated ${CSV_PATH}.`);
        } catch (error) {
            logger.error(`FATAL: Failed to write to ${CSV_PATH}: ${error.message}`);
            process.exit(1);
        }
    } else {
        logger.info("No new data to add. CSV is already up-to-date.");
    }

    // --- Step 6: ALWAYS regenerate the JSON file ---
    try {
        logger.info(`Regenerating ${JSON_PATH}...`);
        // Ensure date column is string in YYYY-MM-DD format for JSON
        const jsonData = df.map(row => ({
            date: row.date.toISOString().split('T')[0],
            price: row.price
        }));
        await fs.writeFile(JSON_PATH, JSON.stringify(jsonData, null, 2));
        logger.info(`Successfully regenerated ${JSON_PATH}.`);
    } catch (error) {
        logger.error(`FATAL: An unexpected error occurred during JSON generation: ${error.message}`);
        process.exit(1);
    }

    logger.info("Script finished successfully.");
}

// Run the main function
if (require.main === module) {
    main();
}