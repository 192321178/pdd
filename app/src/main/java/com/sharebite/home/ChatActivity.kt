package com.sharebite.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.fragments.ChatPreview
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class ChatMessage(
    val messageId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val message: String = "",
    val timestamp: Long = 0L
)

// ✅ Item types for WhatsApp-style date separators
sealed class ChatListItem {
    data class DateHeader(val label: String) : ChatListItem()
    data class Message(val msg: ChatMessage) : ChatListItem()
}

class ChatActivity : AppCompatActivity() {

    private lateinit var rvMessages: RecyclerView
    private lateinit var etMessage: EditText
    private val messages = mutableListOf<ChatMessage>()
    private lateinit var adapter: MessagesAdapter
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        val chatId      = intent.getStringExtra("chat_id") ?: return
        val otherName   = intent.getStringExtra("other_name") ?: "User"
        val otherUserId = intent.getStringExtra("other_user_id") ?: ""
        val foodName    = intent.getStringExtra("food_name") ?: ""

        val currentUser = auth.currentUser
        val myUid  = currentUser?.uid ?: ""
        val myName = currentUser?.displayName ?: currentUser?.email?.substringBefore("@") ?: "You"

        findViewById<TextView>(R.id.tvChatHeaderName).text = otherName
        findViewById<TextView>(R.id.tvChatHeaderFood).text = "Regarding: $foodName"
        findViewById<TextView>(R.id.btnChatBack).setOnClickListener { finish() }

        rvMessages = findViewById(R.id.rvMessages)
        etMessage  = findViewById(R.id.etMessage)

        adapter = MessagesAdapter(mutableListOf(), myUid)
        rvMessages.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        rvMessages.adapter = adapter

        db.getReference("chats").child(chatId)
            .addValueEventListener(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    messages.clear()
                    for (child in snapshot.children) {
                        val msg = child.getValue(ChatMessage::class.java) ?: continue
                        messages.add(msg)
                    }
                    messages.sortBy { it.timestamp }

                    // ✅ Build list with WhatsApp-style date headers
                    val items = mutableListOf<ChatListItem>()
                    var lastDateLabel = ""
                    for (msg in messages) {
                        val label = getDateLabel(msg.timestamp)
                        if (label != lastDateLabel) {
                            items.add(ChatListItem.DateHeader(label))
                            lastDateLabel = label
                        }
                        items.add(ChatListItem.Message(msg))
                    }
                    adapter.updateItems(items)
                    if (items.isNotEmpty()) rvMessages.scrollToPosition(items.size - 1)
                }
                override fun onCancelled(error: DatabaseError) {
                    Toast.makeText(this@ChatActivity, "Error loading messages!", Toast.LENGTH_SHORT).show()
                }
            })

        findViewById<Button>(R.id.btnSend).setOnClickListener {
            val text = etMessage.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener
            if (myUid.isEmpty()) {
                Toast.makeText(this, "Please login first!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val chatsRef = db.getReference("chats").child(chatId)
            val msgId = chatsRef.push().key ?: return@setOnClickListener
            val now = System.currentTimeMillis()

            val msg = ChatMessage(msgId, myUid, myName, text, now)
            chatsRef.child(msgId).setValue(msg).addOnSuccessListener {
                etMessage.setText("")
                val preview = ChatPreview(chatId, otherUserId, otherName, foodName, text, now)
                db.getReference("user_chats").child(myUid).child(chatId).setValue(preview)
                if (otherUserId.isNotEmpty()) {
                    db.getReference("user_chats").child(otherUserId).child(chatId).setValue(
                        preview.copy(otherUserId = myUid, otherUserName = myName)
                    )
                }
            }.addOnFailureListener {
                Toast.makeText(this, "Failed to send. Try again!", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ✅ WhatsApp-style date label: Today / Yesterday / "24 Jun 2026"
    private fun getDateLabel(timestamp: Long): String {
        val msgCal = Calendar.getInstance().apply { timeInMillis = timestamp }
        val today  = Calendar.getInstance()
        val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }

        return when {
            isSameDay(msgCal, today)     -> "Today"
            isSameDay(msgCal, yesterday) -> "Yesterday"
            else -> SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date(timestamp))
        }
    }

    private fun isSameDay(c1: Calendar, c2: Calendar): Boolean =
        c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
                c1.get(Calendar.DAY_OF_YEAR) == c2.get(Calendar.DAY_OF_YEAR)
}

class MessagesAdapter(
    private val items: MutableList<ChatListItem>,
    private val currentUserId: String
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val TYPE_DATE     = 0
        const val TYPE_SENT     = 1
        const val TYPE_RECEIVED = 2
        const val TYPE_SYSTEM   = 3
    }

    fun updateItems(newItems: List<ChatListItem>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun getItemViewType(position: Int): Int {
        return when (val item = items[position]) {
            is ChatListItem.DateHeader -> TYPE_DATE
            is ChatListItem.Message -> when {
                item.msg.senderId == "SYSTEM"        -> TYPE_SYSTEM
                item.msg.senderId == currentUserId   -> TYPE_SENT
                else                                  -> TYPE_RECEIVED
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inf = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_DATE     -> DateHeaderViewHolder(inf.inflate(R.layout.item_date_header, parent, false))
            TYPE_SENT     -> SentViewHolder(inf.inflate(R.layout.item_message_sent, parent, false))
            TYPE_SYSTEM   -> SystemViewHolder(inf.inflate(R.layout.item_message_received, parent, false))
            else          -> ReceivedViewHolder(inf.inflate(R.layout.item_message_received, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = items[position]
        val fmt  = SimpleDateFormat("hh:mm a", Locale.getDefault())
        when {
            holder is DateHeaderViewHolder && item is ChatListItem.DateHeader -> {
                holder.tvDate.text = item.label
            }
            holder is SentViewHolder && item is ChatListItem.Message -> {
                holder.tvMessage.text = item.msg.message
                holder.tvTime.text    = fmt.format(Date(item.msg.timestamp))
            }
            holder is SystemViewHolder && item is ChatListItem.Message -> {
                holder.tvMessage.text = item.msg.message
                holder.tvTime.text    = fmt.format(Date(item.msg.timestamp))
            }
            holder is ReceivedViewHolder && item is ChatListItem.Message -> {
                holder.tvMessage.text = item.msg.message
                holder.tvTime.text    = fmt.format(Date(item.msg.timestamp))
            }
        }
    }

    override fun getItemCount() = items.size

    class DateHeaderViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvDate: TextView = view.findViewById(R.id.tvDateHeader)
    }
    class SentViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvMessage: TextView = view.findViewById(R.id.tvSentMessage)
        val tvTime: TextView    = view.findViewById(R.id.tvSentTime)
    }
    class ReceivedViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvMessage: TextView = view.findViewById(R.id.tvReceivedMessage)
        val tvTime: TextView    = view.findViewById(R.id.tvReceivedTime)
    }
    class SystemViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvMessage: TextView = view.findViewById(R.id.tvReceivedMessage)
        val tvTime: TextView    = view.findViewById(R.id.tvReceivedTime)
    }
}