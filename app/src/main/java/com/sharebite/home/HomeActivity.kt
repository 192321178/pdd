package com.sharebite.home

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.databinding.ActivityHomeBinding
import com.sharebite.fragments.FoodDataStore

class HomeActivity : AppCompatActivity() {
    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHost = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHost.navController

        binding.bottomNav.setupWithNavController(navController)

        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.feedFragment     -> navController.navigate(R.id.feedFragment)
                R.id.mapFragment      -> navController.navigate(R.id.mapFragment)
                R.id.placeholder      -> navController.navigate(R.id.shareFragment)
                R.id.messagesFragment -> navController.navigate(R.id.messagesFragment)
                R.id.profileFragment  -> navController.navigate(R.id.profileFragment)
            }
            true
        }

        binding.fabShare.setOnClickListener {
            navController.navigate(R.id.shareFragment)
        }

        FoodDataStore.startRealTimeListener { }
        setupBadge()
    }

    private fun setupBadge() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return

        val userChatsDb = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("user_chats")
            .child(uid)

        val prefs = getSharedPreferences("chat_read_times", MODE_PRIVATE)

        // ✅ Fix: On first login, seed all existing chats as "read" so old conversations
        // don't show as unread. Check using a "seeded_{uid}" flag per user.
        val seededKey = "seeded_$uid"
        if (!prefs.getBoolean(seededKey, false)) {
            userChatsDb.get().addOnSuccessListener { snapshot ->
                val editor = prefs.edit()
                for (child in snapshot.children) {
                    val chatId = child.child("chatId").getValue(String::class.java) ?: child.key ?: continue
                    // Only seed if not already set — marks all existing chats as read
                    if (!prefs.contains("lastRead_$chatId")) {
                        editor.putLong("lastRead_$chatId", System.currentTimeMillis())
                    }
                }
                editor.putBoolean(seededKey, true)
                editor.apply()
            }
        }

        userChatsDb.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var unreadCount = 0
                for (child in snapshot.children) {
                    val chatId    = child.child("chatId").getValue(String::class.java) ?: child.key ?: continue
                    val timestamp = child.child("timestamp").getValue(Long::class.java) ?: 0L
                    val lastMsg   = child.child("lastMessage").getValue(String::class.java) ?: ""
                    // ✅ Per-chat lastRead — same key MessagesFragment writes on chat open
                    val lastRead  = prefs.getLong("lastRead_${chatId}", 0L)
                    if (timestamp > lastRead && lastMsg.isNotEmpty()) {
                        unreadCount++
                    }
                }

                val badge = binding.bottomNav.getOrCreateBadge(R.id.messagesFragment)
                if (unreadCount > 0) {
                    badge.isVisible = true
                    badge.number    = unreadCount
                    badge.backgroundColor = getColor(android.R.color.holo_red_light)
                } else {
                    badge.isVisible = false
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    override fun onResume() {
        super.onResume()
        FoodDataStore.startRealTimeListener { }
    }

    override fun onDestroy() {
        super.onDestroy()
        FoodDataStore.stopListener()
    }
}