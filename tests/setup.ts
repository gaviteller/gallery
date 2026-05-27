import { JSDOM } from "jsdom"

// Set up JSDOM for browser APIs
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>")
const { window } = dom
const { document } = window

// Assign to global
Object.assign(global, { window, document })
