# Appium Testing Guide for ShareBite

This folder contains a data-driven testing framework for the ShareBite app.

## Project Structure
- `test_data.csv`: The **Excel-compatible** list of test scenarios and data.
- `src/test/java/com/sharebite/testing/TestDataReader.java`: The utility used to read data from the CSV/Excel sheet.
- `src/test/java/com/sharebite/testing/ShareBiteAppiumTest.java`: The core Appium test script.

## How to use the Excel Sheet
1. Open the `testing/test_data.csv` file using **Microsoft Excel**.
2. You can add new test cases by adding rows to this sheet.
3. Save the file. The Java tests will automatically pick up the new rows.

## Running the Tests
1. **Prerequisites**:
   - Install Appium Server and Android Studio (Emulator).
   - Ensure you have a Java development environment.
2. **Setup**:
   - Update the `setApp("path/to/your/app.apk")` in `ShareBiteAppiumTest.java` with the actual path to your APK file.
3. **Execution**:
   - Run the tests using your IDE (as a TestNG test) or via Maven.
