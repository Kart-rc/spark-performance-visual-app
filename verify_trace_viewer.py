from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto("http://localhost:4173")

            # Wait for Mission 1 Start button and click it
            page.click("text=Start mission >> nth=0")

            # Wait for the dashboard to load (look for "App Lineage" which is in the observability panel)
            page.wait_for_selector("text=App Lineage", timeout=10000)

            # Scroll to the bottom to bring the panel into view
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

            # Click the Telemetry Traces tab
            page.click("text=Telemetry Traces")

            # Wait a moment for the trace viewer to render
            page.wait_for_timeout(2000)

            # Take screenshot
            page.screenshot(path="/home/jules/verification/trace_viewer.png")
            print("Screenshot saved to /home/jules/verification/trace_viewer.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_trace_viewer.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
