/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFileSync } from 'node:fs';
import { BatchedNetworkSimulator, Saiga } from './main.ts';

const SNAPSHOT = './snapshot.json';
const NUM_ROUNDS = 100000;

function run() {
  console.log("This simulation will take about 60 seconds to complete.");
  let flushReport;
  const networkSimulator = new BatchedNetworkSimulator();
  const snapshot = readFileSync(SNAPSHOT, 'utf8');
  try {
    networkSimulator.fromSnapshot(JSON.parse(snapshot));
  } catch (error) {
    console.log("Error parsing snapshot", error);
  }
  console.log("Network simulator initialized.");
  let counter = 0;
  do {
    flushReport = networkSimulator.flush();
  } while ((flushReport.length > 0) && (counter++ < NUM_ROUNDS));
  console.log("Simulation completed.");
}

// ...
run();