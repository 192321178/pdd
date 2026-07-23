package com.sharebite.home

import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FoodHistoryActivity : AppCompatActivity() {

    private val rtdb = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")

    private var showingDonated = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_food_history)

        val uid      = intent.getStringExtra("uid")       ?: run { finish(); return }
        val userName = intent.getStringExtra("user_name") ?: "User"

        findViewById<View>(R.id.btnBackHistory)?.setOnClickListener { finish() }
        findViewById<TextView>(R.id.tvHistoryTitle)?.text = "$userName's Food History"

        val btnDonated = findViewById<TextView>(R.id.btnTabDonated)
        val btnClaimed = findViewById<TextView>(R.id.btnTabClaimed)

        btnDonated?.setOnClickListener {
            showingDonated = true
            btnDonated.setBackgroundResource(R.drawable.bg_chip_selected)
            btnClaimed?.setBackgroundResource(R.drawable.bg_chip_unselected)
            loadHistory(uid, "donated")
        }

        btnClaimed?.setOnClickListener {
            showingDonated = false
            btnClaimed.setBackgroundResource(R.drawable.bg_chip_selected)
            btnDonated?.setBackgroundResource(R.drawable.bg_chip_unselected)
            loadHistory(uid, "claimed")
        }

        // Load donated by default
        loadHistory(uid, "donated")
    }

    private fun loadHistory(uid: String, type: String) {
        val container = findViewById<LinearLayout>(R.id.layoutHistoryList) ?: return
        val tvEmpty   = findViewById<TextView>(R.id.tvNoHistory)

        rtdb.getReference("food_history").child(uid).child(type)
            .addValueEventListener(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    container.removeAllViews()

                    if (!snapshot.exists() || snapshot.childrenCount == 0L) {
                        tvEmpty?.visibility = View.VISIBLE
                        tvEmpty?.text = if (type == "donated")
                            "No donated food yet — share food to see history!"
                        else
                            "No claimed food yet — claim food to see history!"
                        return
                    }

                    tvEmpty?.visibility = View.GONE

                    val items = mutableListOf<Map<String, Any?>>()
                    snapshot.children.forEach { child ->
                        items.add(mapOf(
                            "foodName"    to (child.child("foodName").getValue(String::class.java) ?: ""),
                            "otherName"   to ((if (type == "donated")
                                child.child("claimerName").getValue(String::class.java)
                            else
                                child.child("donorName").getValue(String::class.java)) ?: ""),
                            "location"    to (child.child("location").getValue(String::class.java) ?: ""),
                            "category"    to (child.child("category").getValue(String::class.java) ?: ""),
                            "timestamp"   to ((if (type == "donated")
                                child.child("verifiedAt").getValue(Long::class.java)
                            else
                                child.child("receivedAt").getValue(Long::class.java)) ?: 0L),
                            "rating"      to child.child("rating").getValue(Int::class.java),
                            "feedback"    to (child.child("feedback").getValue(String::class.java) ?: "")
                        ))
                    }

                    // Sort newest first
                    items.sortByDescending { it["timestamp"] as Long }

                    items.forEach { item ->
                        val foodName  = item["foodName"] as String
                        val otherName = item["otherName"] as String
                        val location  = item["location"] as String
                        val category  = item["category"] as String
                        val timestamp = item["timestamp"] as Long
                        val rating    = item["rating"] as? Int
                        val feedback  = item["feedback"] as String
                        val dateStr   = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
                            .format(Date(timestamp))

                        val card = LinearLayout(this@FoodHistoryActivity).apply {
                            orientation = LinearLayout.VERTICAL
                            setPadding(32, 24, 32, 24)
                            setBackgroundResource(android.R.drawable.dialog_holo_light_frame)
                            val lp = LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT
                            )
                            lp.setMargins(0, 0, 0, 24)
                            layoutParams = lp
                        }

                        // Food name + category
                        card.addView(TextView(this@FoodHistoryActivity).apply {
                            text     = "🍛 $foodName"
                            textSize = 16f
                            setTypeface(null, android.graphics.Typeface.BOLD)
                            setTextColor(resources.getColor(android.R.color.black, null))
                        })

                        card.addView(TextView(this@FoodHistoryActivity).apply {
                            text     = category
                            textSize = 12f
                            setTextColor(resources.getColor(R.color.green_primary, null))
                            setPadding(0, 4, 0, 4)
                        })

                        // Location + date
                        card.addView(TextView(this@FoodHistoryActivity).apply {
                            text     = "📍 $location · $dateStr"
                            textSize = 12f
                            setTextColor(resources.getColor(android.R.color.darker_gray, null))
                        })

                        // Other person
                        if (otherName.isNotEmpty()) {
                            card.addView(TextView(this@FoodHistoryActivity).apply {
                                text = if (type == "donated") "👤 Claimed by: $otherName"
                                else "👤 From: $otherName"
                                textSize = 13f
                                setPadding(0, 8, 0, 4)
                                setTextColor(resources.getColor(android.R.color.black, null))
                            })
                        }

                        // Rating (for claimed items)
                        if (type == "claimed" && rating != null && rating > 0) {
                            val stars = "★".repeat(rating) + "☆".repeat(5 - rating)
                            card.addView(TextView(this@FoodHistoryActivity).apply {
                                text     = "⭐ You rated: $stars"
                                textSize = 13f
                                setPadding(0, 4, 0, 0)
                                setTextColor(resources.getColor(android.R.color.holo_orange_dark, null))
                            })
                            if (feedback.isNotEmpty()) {
                                card.addView(TextView(this@FoodHistoryActivity).apply {
                                    text     = "\"$feedback\""
                                    textSize = 12f
                                    setTextColor(resources.getColor(android.R.color.darker_gray, null))
                                })
                            }
                        }

                        // Verified badge for donated items
                        if (type == "donated" && timestamp > 0) {
                            card.addView(TextView(this@FoodHistoryActivity).apply {
                                text     = "✅ Verified & Collected"
                                textSize = 12f
                                setTextColor(resources.getColor(R.color.green_primary, null))
                                setPadding(0, 8, 0, 0)
                            })
                        }

                        container.addView(card)
                    }
                }
                override fun onCancelled(e: DatabaseError) {}
            })
    }
}