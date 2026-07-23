package com.sharebite.home

import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FeedbackActivity : AppCompatActivity() {

    private val rtdb = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_feedback)

        val donorUid  = intent.getStringExtra("donor_uid")  ?: run { finish(); return }
        val donorName = intent.getStringExtra("donor_name") ?: "User"

        findViewById<View>(R.id.btnBackFeedback)?.setOnClickListener { finish() }
        findViewById<TextView>(R.id.tvFeedbackTitle)?.text = "Reviews for $donorName"

        loadReviews(donorUid)
    }

    private fun loadReviews(donorUid: String) {
        val container  = findViewById<LinearLayout>(R.id.layoutReviewsList) ?: return
        val tvSummary  = findViewById<TextView>(R.id.tvRatingSummary)
        val tvEmpty    = findViewById<TextView>(R.id.tvNoReviews)

        rtdb.getReference("ratings").child(donorUid)
            .addValueEventListener(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    container.removeAllViews()

                    if (!snapshot.exists() || snapshot.childrenCount == 0L) {
                        tvEmpty?.visibility = View.VISIBLE
                        tvSummary?.text     = "No reviews yet"
                        return
                    }

                    tvEmpty?.visibility = View.GONE

                    var total = 0.0
                    var count = 0
                    val reviews = mutableListOf<Map<String, Any>>()

                    snapshot.children.forEach { child ->
                        val rating       = child.child("rating").getValue(Int::class.java) ?: 0
                        val feedback     = child.child("feedback").getValue(String::class.java) ?: ""
                        val reviewerName = child.child("reviewerName").getValue(String::class.java) ?: "User"
                        val foodName     = child.child("foodName").getValue(String::class.java) ?: ""
                        val timestamp    = child.child("timestamp").getValue(Long::class.java) ?: 0L

                        total += rating; count++
                        reviews.add(mapOf(
                            "rating" to rating, "feedback" to feedback,
                            "reviewerName" to reviewerName, "foodName" to foodName,
                            "timestamp" to timestamp
                        ))
                    }

                    val avg = if (count > 0) Math.round(total / count * 10.0) / 10.0 else 0.0
                    tvSummary?.text = "★ $avg average · $count review${if (count != 1) "s" else ""}"

                    // Sort newest first
                    reviews.sortByDescending { it["timestamp"] as Long }

                    reviews.forEach { review ->
                        val rating       = review["rating"] as Int
                        val feedback     = review["feedback"] as String
                        val reviewerName = review["reviewerName"] as String
                        val foodName     = review["foodName"] as String
                        val timestamp    = review["timestamp"] as Long
                        val dateStr      = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
                            .format(Date(timestamp))
                        val stars        = "★".repeat(rating) + "☆".repeat(5 - rating)

                        // Build review card programmatically
                        val card = LinearLayout(this@FeedbackActivity).apply {
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

                        card.addView(TextView(this@FeedbackActivity).apply {
                            text     = "$stars  $reviewerName"
                            textSize = 15f
                            setTextColor(resources.getColor(android.R.color.black, null))
                        })

                        if (foodName.isNotEmpty()) {
                            card.addView(TextView(this@FeedbackActivity).apply {
                                text     = "Food: $foodName"
                                textSize = 12f
                                setTextColor(resources.getColor(R.color.green_primary, null))
                                setPadding(0, 4, 0, 4)
                            })
                        }

                        if (feedback.isNotEmpty()) {
                            card.addView(TextView(this@FeedbackActivity).apply {
                                text     = "\"$feedback\""
                                textSize = 14f
                                setTextColor(resources.getColor(android.R.color.darker_gray, null))
                                setPadding(0, 8, 0, 8)
                            })
                        }

                        card.addView(TextView(this@FeedbackActivity).apply {
                            text     = dateStr
                            textSize = 11f
                            setTextColor(resources.getColor(android.R.color.darker_gray, null))
                        })

                        container.addView(card)
                    }
                }
                override fun onCancelled(e: DatabaseError) {
                    Toast.makeText(this@FeedbackActivity, "Error loading reviews", Toast.LENGTH_SHORT).show()
                }
            })
    }
}