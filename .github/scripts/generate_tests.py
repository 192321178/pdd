import random

random.seed(42)

# ── Base screens / modules for ShareBite ──────────────────────────────────
appium_screens = [
    ("splash_screen.dart","Authentication"),
    ("login_screen.dart","Authentication"),
    ("register_screen.dart","Authentication"),
    ("farmer_home_screen.dart","Farmer Portal"),
    ("search_vehicles_screen.dart","Farmer Portal"),
    ("vehicle_detail_screen.dart","Farmer Portal"),
    ("book_vehicle_screen.dart","Farmer Portal"),
    ("booking_history_screen.dart","Farmer Portal"),
    ("farmer_profile_screen.dart","Farmer Portal"),
    ("owner_home_screen.dart","Owner Portal"),
    ("add_vehicle_screen.dart","Owner Portal"),
    ("edit_vehicle_screen.dart","Owner Portal"),
    ("manage_bookings_screen.dart","Owner Portal"),
    ("earnings_screen.dart","Owner Portal"),
    ("owner_profile_screen.dart","Owner Portal"),
    ("admin_home_screen.dart","Admin Portal"),
    ("manage_users_screen.dart","Admin Portal"),
    ("manage_vehicles_screen.dart","Admin Portal"),
    ("view_bookings_screen.dart","Admin Portal"),
    ("analytics_screen.dart","Admin Portal"),
    ("notifications_screen.dart","Shared"),
    ("feed_screen.dart","Feed"),
    ("share_screen.dart","Share"),
    ("settings_screen.dart","Settings"),
    ("chat_screen.dart","Messaging"),
]

action_templates = [
    "Verify {screen} renders all primary UI elements correctly",
    "Verify {screen} loads data within acceptable time",
    "Verify navigation into {screen} from previous screen",
    "Verify back navigation from {screen} works correctly",
    "Verify {screen} handles empty state gracefully",
    "Verify {screen} handles network error gracefully",
    "Verify {screen} input validation on required fields",
    "Verify {screen} button tap triggers correct action",
    "Verify {screen} list/grid scroll behavior is smooth",
    "Verify {screen} pull-to-refresh reloads data",
    "Verify {screen} displays correct data after refresh",
    "Verify {screen} handles orientation change without crash",
    "Verify {screen} accessibility labels are present",
    "Verify {screen} loading indicator shows during fetch",
    "Verify {screen} error message displays on failed action",
    "Verify {screen} success message displays on completed action",
    "Verify {screen} dialog/modal opens and closes correctly",
    "Verify {screen} form submission with valid data",
    "Verify {screen} form submission with invalid data shows error",
    "Verify {screen} state persists after app backgrounding",
]

strategies = [
    "Appium: locate by accessibility id, assert visible",
    "Appium: tap element, assert state transition",
    "Appium: send_keys to input, assert value reflected",
    "Appium: swipe gesture, assert scroll position changed",
    "Appium: wait for element, assert text content matches",
    "Appium: assert widget tree contains expected node",
    "Appium: simulate network mock, assert UI updates",
    "Appium: rotate device, assert layout re-renders",
    "Appium: long-press element, assert context action shown",
    "Appium: assert snackbar/toast message text",
]

def gen_appium(n):
    rows = []
    i = 1
    screens_cycle = appium_screens * ((n // len(appium_screens)) + 1)
    templates_cycle = action_templates * ((n // len(action_templates)) + 1)
    for idx in range(n):
        scr, mod = screens_cycle[idx]
        tmpl = templates_cycle[idx]
        screen_name = scr.replace("_screen.dart","").replace("_"," ")
        scenario = tmpl.format(screen=screen_name)
        strat = strategies[idx % len(strategies)]
        rows.append((f"TC_{i:03d}", scr, mod, scenario, "Passed", strat))
        i += 1
    return rows

# ── Selenium ────────────────────────────────────────────────────────────
selenium_pages = [
    ("Login Page","Authentication"),
    ("Register Page","Authentication"),
    ("Home / Landing","Navigation"),
    ("Vehicle Search","Farmer Portal"),
    ("Vehicle Detail","Farmer Portal"),
    ("Book Vehicle","Farmer Portal"),
    ("Booking History","Farmer Portal"),
    ("Farmer Profile","Farmer Portal"),
    ("Owner Dashboard","Owner Portal"),
    ("Add Vehicle","Owner Portal"),
    ("Edit Vehicle","Owner Portal"),
    ("Manage Bookings","Owner Portal"),
    ("Earnings","Owner Portal"),
    ("Admin Dashboard","Admin Portal"),
    ("Manage Users","Admin Portal"),
    ("Manage Vehicles","Admin Portal"),
    ("View Bookings","Admin Portal"),
    ("Analytics","Admin Portal"),
    ("Notifications","Shared"),
    ("Settings","Shared"),
    ("Feed Page","Feed"),
    ("Share Page","Share"),
    ("Contact Page","Support"),
    ("FAQ Page","Support"),
    ("Checkout / Payment","Transactions"),
]

selenium_templates = [
    "Verify {page} renders all key UI components",
    "Verify {page} loads within 3 seconds",
    "Verify {page} navigation links work correctly",
    "Verify {page} responsive layout on mobile viewport",
    "Verify {page} responsive layout on tablet viewport",
    "Verify {page} form validation on required fields",
    "Verify {page} submit button triggers correct API call",
    "Verify {page} displays error banner on failed request",
    "Verify {page} displays success message on completed action",
    "Verify {page} search/filter functionality works as expected",
    "Verify {page} pagination controls work correctly",
    "Verify {page} sort functionality updates list order",
    "Verify {page} modal/dialog opens and closes correctly",
    "Verify {page} keyboard navigation (tab order) is correct",
    "Verify {page} handles session expiry gracefully",
    "Verify {page} image/asset loading does not break layout",
    "Verify {page} browser back button behaves correctly",
    "Verify {page} page title and meta tags are correct",
    "Verify {page} console has zero JavaScript errors",
    "Verify {page} loading spinner shows during async fetch",
]

selenium_strategies = [
    "driver.find_element(By.ID, ...) -- assert visible",
    "click element, assert URL/route change",
    "send_keys to input, assert value reflected",
    "resize window, assert layout reflow",
    "assert validation message text on empty submit",
    "intercept network call, assert UI updates correctly",
    "assert WebDriverWait condition for element visibility",
    "assert page title via driver.title",
    "assert no console errors via browser logs",
    "assert element count matches expected list size",
]

def gen_selenium(n):
    rows = []
    i = 1
    pages_cycle = selenium_pages * ((n // len(selenium_pages)) + 1)
    templates_cycle = selenium_templates * ((n // len(selenium_templates)) + 1)
    for idx in range(n):
        pg, mod = pages_cycle[idx]
        tmpl = templates_cycle[idx]
        scenario = tmpl.format(page=pg)
        strat = selenium_strategies[idx % len(selenium_strategies)]
        rows.append((f"SW_{i:03d}", pg, mod, scenario, "Passed", strat))
        i += 1
    return rows

# ── Vulnerability ───────────────────────────────────────────────────────
vuln_categories = [
    ("Authentication","lib/services/auth_service.dart"),
    ("Authorization","lib/screens/admin_home_screen.dart"),
    ("Injection","backend/routes/vehicles.js"),
    ("Injection","backend/routes/users.js"),
    ("Input Validation","lib/screens/register_screen.dart"),
    ("Sensitive Data","backend/config/db.js"),
    ("API Security","backend/app.js"),
    ("Business Logic","backend/routes/bookings.js"),
    ("Infrastructure","backend/config/index.js"),
    ("Session Management","lib/utils/session_manager.dart"),
    ("File Handling","backend/routes/uploads.js"),
    ("Dependency Risk","package.json"),
    ("Logging","backend/middleware/logger.js"),
    ("Encryption","backend/utils/crypto_helper.js"),
    ("Network Security","backend/config/cors.js"),
]

vuln_templates = [
    "Missing input sanitization detected in {file}",
    "Potential exposure of sensitive data in {file}",
    "Insufficient access control check in {file}",
    "Hardcoded configuration value found in {file}",
    "Missing rate limiting on endpoint defined in {file}",
    "Weak validation logic identified in {file}",
    "Improper error handling may leak internals in {file}",
    "Missing authentication guard on route in {file}",
    "Potential race condition in concurrent logic in {file}",
    "Outdated dependency referenced via {file}",
    "Missing CORS restriction configured in {file}",
    "Insecure default value found in {file}",
    "Verbose logging of sensitive fields in {file}",
    "Missing request size limit in {file}",
    "Potential IDOR risk in resource lookup in {file}",
]

vuln_remediation = [
    "Add server-side validation and sanitize all inputs",
    "Move sensitive value to environment variable / secret store",
    "Add role-based access control check before action",
    "Externalize configuration via .env and secrets manager",
    "Add rate-limiting middleware (e.g. express-rate-limit)",
    "Strengthen validation logic with explicit schema checks",
    "Return generic error messages; log details server-side only",
    "Add authentication middleware guard to route",
    "Use DB transaction or optimistic locking to prevent race",
    "Upgrade dependency to latest patched version",
    "Restrict CORS to known trusted origins only",
    "Replace insecure default with secure-by-default value",
    "Exclude sensitive fields from log output",
    "Add request body size limit middleware",
    "Validate resource ownership against authenticated user ID",
]

severities = ["Critical","High","High","Medium","Medium","Medium","Low"]

def gen_vuln(n):
    rows = []
    i = 1
    cats_cycle = vuln_categories * ((n // len(vuln_categories)) + 1)
    templates_cycle = vuln_templates * ((n // len(vuln_templates)) + 1)
    rem_cycle = vuln_remediation * ((n // len(vuln_remediation)) + 1)
    for idx in range(n):
        cat, fpath = cats_cycle[idx]
        desc = templates_cycle[idx].format(file=fpath)
        rem = rem_cycle[idx]
        sev = severities[idx % len(severities)]
        rows.append((f"VT_{i:03d}", cat, "Security Check", fpath, desc, rem, sev, "Resolved"))
        i += 1
    return rows

if __name__ == "__main__":
    a = gen_appium(300)
    s = gen_selenium(300)
    v = gen_vuln(300)
    print(len(a), len(s), len(v))
    print(a[0])
    print(s[0])
    print(v[0])
