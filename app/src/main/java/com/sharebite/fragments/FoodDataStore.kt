package com.sharebite.fragments

import android.content.Context
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import java.util.UUID

data class FoodItem(
    val id: String = UUID.randomUUID().toString(),
    val foodName: String = "",
    val quantity: String = "",
    val category: String = "",
    val description: String = "",
    val location: String = "",
    val userName: String = "You",
    val userUid: String = "",
    val imageUri: String? = null,
    val expiryTimeMillis: Long = 0L,
    val isClaimed: Boolean = false,
    val claimedByUid: String = ""
)

object FoodDataStore {
    val items = mutableListOf<FoodItem>()

    private val db = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
        .getReference("food_items")

    private var listener: ValueEventListener? = null
    var isListening = false  // ✅ public — FeedFragment access பண்ணும்

    fun startRealTimeListener(onUpdate: () -> Unit) {
        // ✅ Every time fresh listener — app reopen-லயும் data வரும்
        listener?.let { db.removeEventListener(it) }
        isListening = false

        isListening = true
        listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                items.clear()
                val now = System.currentTimeMillis()
                for (child in snapshot.children) {
                    val item = child.getValue(FoodItem::class.java) ?: continue
                    if (item.expiryTimeMillis > 0 && now > item.expiryTimeMillis) {
                        db.child(item.id).removeValue()
                        continue
                    }
                    items.add(item)
                }
                onUpdate()  // ✅ Data ready ஆனதும் UI update
            }
            override fun onCancelled(error: DatabaseError) {
                isListening = false
            }
        }
        db.addValueEventListener(listener!!)
    }

    fun load(context: Context, onLoaded: (() -> Unit)? = null) {
        db.get().addOnSuccessListener { snapshot ->
            items.clear()
            val now = System.currentTimeMillis()
            for (child in snapshot.children) {
                val item = child.getValue(FoodItem::class.java) ?: continue
                if (item.expiryTimeMillis > 0 && now > item.expiryTimeMillis) continue
                items.add(item)
            }
            onLoaded?.invoke()
        }
    }

    fun saveItem(item: FoodItem) {
        db.child(item.id).setValue(item)
    }

    fun save(context: Context) {
        items.forEach { item ->
            db.child(item.id).setValue(item)
        }
    }

    fun updateClaimed(itemId: String) {
        db.child(itemId).child("isClaimed").setValue(true)
        val index = items.indexOfFirst { it.id == itemId }
        if (index != -1) {
            items[index] = items[index].copy(isClaimed = true)
        }
    }

    fun delete(itemId: String) {
        db.child(itemId).removeValue()
        items.removeIf { it.id == itemId }
    }

    fun stopListener() {
        listener?.let { db.removeEventListener(it) }
        isListening = false
        listener = null
    }
}