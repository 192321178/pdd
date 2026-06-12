package com.sharebite.testing;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Utility to read test data for Appium automated tests.
 */
public class TestDataReader {

    /**
     * Reads data from a CSV file (supported by Excel) and returns it as a list of maps.
     */
    public static List<Map<String, String>> readTestData(String filePath) {
        List<Map<String, String>> testDataList = new ArrayList<>();
        String line;
        String[] headers = null;

        try (BufferedReader br = new BufferedReader(new FileReader(filePath))) {
            if ((line = br.readLine()) != null) {
                headers = line.split(",");
            }

            while ((line = br.readLine()) != null) {
                String[] values = line.split(",");
                Map<String, String> dataMap = new HashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    if (i < values.length) {
                        dataMap.put(headers[i], values[i]);
                    } else {
                        dataMap.put(headers[i], "");
                    }
                }
                testDataList.add(dataMap);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return testDataList;
    }
}
