package com.sharebite.testing;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import org.openqa.selenium.By;
import org.testng.Assert;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;
import java.util.Map;

/**
 * Sample Appium Test for ShareBite App using Data-Driven approach.
 */
public class ShareBiteAppiumTest {

    private AndroidDriver driver;

    @BeforeClass
    public void setup() throws MalformedURLException {
        UiAutomator2Options options = new UiAutomator2Options()
                .setPlatformName("Android")
                .setApp("path/to/your/app.apk") // Replace with actual APK path
                .setAutomationName("UiAutomator2")
                .setNoReset(true);

        driver = new AndroidDriver(new URL("http://127.0.0.1:4723"), options);
    }

    @Test
    public void testDataDrivenFlows() {
        // Path to the CSV file (Excel-compatible)
        String csvPath = "testing/test_data.csv";
        List<Map<String, String>> testData = TestDataReader.readTestData(csvPath);

        for (Map<String, String> data : testData) {
            System.out.println("Running Scenario: " + data.get("ScenarioID"));

            if (data.get("ScenarioID").startsWith("TC_LOGIN")) {
                runLoginScenario(data);
            } else if (data.get("ScenarioID").startsWith("TC_SHARE")) {
                runShareScenario(data);
            }
        }
    }

    private void runLoginScenario(Map<String, String> data) {
        // Example implementation for Login flow
        driver.findElement(By.id("com.sharebite:id/etLoginEmail")).sendKeys(data.get("Email"));
        driver.findElement(By.id("com.sharebite:id/etLoginPassword")).sendKeys(data.get("Password"));
        driver.findElement(By.id("com.sharebite:id/btnLogin")).click();

        // Add assertions based on ExpectSuccess
        // Example: Assert.assertTrue(driver.findElement(By.id("success_element")).isDisplayed());
    }

    private void runShareScenario(Map<String, String> data) {
        // Example implementation for Sharing food
        // 1. Navigate to Share Fragment
        // 2. Fill in data from Map: FoodName, Category, Quantity, etc.
        // 3. Submit and verify
    }

    @AfterClass
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}
