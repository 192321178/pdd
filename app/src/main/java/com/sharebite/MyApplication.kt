package com.sharebite

import android.app.Application
import com.google.firebase.database.FirebaseDatabase

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // ✅ App close ஆனாலும் data cache-ல் இருக்கும்
        // Reopen பண்ணினதும் உடனே காட்டும்
        FirebaseDatabase.getInstance(
            "https://sharebite-7143d-default-rtdb.firebaseio.com"
        ).setPersistenceEnabled(true)
    }
}