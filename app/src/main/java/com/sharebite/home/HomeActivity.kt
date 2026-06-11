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
        setupBellBadge()
    }

    private fun setupBellBadge() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return

        val userChatsDb = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("user_chats")
            .child(uid)

        userChatsDb.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val prefs    = getSharedPreferences("sharebite_prefs", MODE_PRIVATE)
                val lastSeen = prefs.getLong("messages_last_seen", 0L)

                var unreadCount = 0
                for (child in snapshot.children) {
                    val timestamp = child.child("timestamp").getValue(Long::class.java) ?: 0L
                    val lastMsg   = child.child("lastMessage").getValue(String::class.java) ?: ""
                    if (timestamp > lastSeen && lastMsg.isNotEmpty()) {
                        unreadCount++
                    }
                }

                val badge = binding.root.findViewById<TextView>(R.id.tvBadge)
                if (badge != null) {
                    if (unreadCount > 0) {
                        badge.text       = if (unreadCount > 9) "9+" else unreadCount.toString()
                        badge.visibility = View.VISIBLE
                    } else {
                        badge.visibility = View.GONE
                    }
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