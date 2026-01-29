from playwright.sync_api import sync_playwright, expect
import time

def test_app(page):
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PageError: {err}"))

    print("Navigating to home...")
    page.goto("http://localhost:1420")

    # Wait longer
    time.sleep(2)

    # Wait for Dashboard to load (look for "Hello, Jason")
    print("Waiting for Dashboard...")
    expect(page.get_by_text("Hello, Jason!")).to_be_visible(timeout=10000)

    print("Taking Dashboard screenshot...")
    page.screenshot(path="verification/dashboard.png")

    # Click Clients in NavBar
    print("Clicking Clients...")
    page.click("a[href='/clients']")

    print("Waiting for Clients page...")
    expect(page.get_by_text("Client List")).to_be_visible()

    print("Taking Clients screenshot...")
    page.screenshot(path="verification/clients.png")

    # Click Invoices in NavBar
    print("Clicking Invoices...")
    page.click("a[href='/invoices']")

    print("Waiting for Invoices page...")
    expect(page.get_by_text("All Invoices")).to_be_visible()

    print("Taking Invoices screenshot...")
    page.screenshot(path="verification/invoices.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_app(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
