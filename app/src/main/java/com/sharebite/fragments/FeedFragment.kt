package com.sharebite.fragments

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.bumptech.glide.Glide
import com.sharebite.R
import com.sharebite.home.FoodDetailActivity
import java.io.File

class FeedFragment : Fragment() {

    private val handler = Handler(Looper.getMainLooper())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_feed, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val chipAll     = view.findViewById<TextView>(R.id.chipAll)
        val chipCooked  = view.findViewById<TextView>(R.id.chipCooked)
        val chipProduce = view.findViewById<TextView>(R.id.chipProduce)
        val chips = listOf(chipAll, chipCooked, chipProduce)

        chips.forEach { chip ->
            chip.setOnClickListener {
                chips.forEach { c ->
                    if (c == chip) {
                        c.background = ContextCompat.getDrawable(requireContext(), R.drawable.bg_chip_selected)
                        c.setTextColor(ContextCompat.getColor(requireContext(), R.color.white))
                    } else {
                        c.background = ContextCompat.getDrawable(requireContext(), R.drawable.bg_chip_unselected)
                        c.setTextColor(ContextCompat.getColor(requireContext(), R.color.black))
                    }
                }
                loadFeedData(view)
            }
        }

        FoodDataStore.startRealTimeListener {
            if (isAdded && this.view != null) {
                requireActivity().runOnUiThread {
                    loadFeedData(view)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (FoodDataStore.items.isNotEmpty()) {
            view?.let { loadFeedData(it) }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        handler.removeCallbacksAndMessages(null)
    }

    private fun loadFeedData(view: View) {
        if (!isAdded) return

        val now = System.currentTimeMillis()
        val feedContainer = view.findViewById<LinearLayout>(R.id.feedContainer)
        val defaultCard   = view.findViewById<CardView>(R.id.foodCard)
        val tvCount       = view.findViewById<TextView>(R.id.tvListingCount)

        val validItems = FoodDataStore.items.filter { item ->
            item.expiryTimeMillis <= 0 || now <= item.expiryTimeMillis
        }

        if (validItems.isEmpty()) {
            defaultCard.visibility = View.VISIBLE
            tvCount?.text = "No listings"
            if (feedContainer.childCount > 1) {
                feedContainer.removeViews(1, feedContainer.childCount - 1)
            }
            return
        }

        defaultCard.visibility = View.GONE
        tvCount?.text = "${validItems.size} listings"

        if (feedContainer.childCount > 1) {
            feedContainer.removeViews(1, feedContainer.childCount - 1)
        }

        validItems.forEach { item ->
            val card = layoutInflater.inflate(R.layout.item_food_card, feedContainer, false)

            card.findViewById<TextView>(R.id.tvCardFoodName).text = item.foodName
            card.findViewById<TextView>(R.id.tvCardCategory).text = item.category
            card.findViewById<TextView>(R.id.tvCardQuantity).text = item.quantity
            card.findViewById<TextView>(R.id.tvCardUserName).text = item.userName
            card.findViewById<TextView>(R.id.tvCardDesc).text =
                item.description.ifEmpty { "Fresh and ready to pick up!" }

            val tvTimer   = card.findViewById<TextView>(R.id.tvCardTimer)
            val remaining = item.expiryTimeMillis - now
            if (remaining > 0) {
                val hrs  = remaining / 3_600_000
                val mins = (remaining % 3_600_000) / 60_000
                tvTimer.text       = if (hrs > 0) "${hrs}h ${mins}m left" else "${mins}m left"
                tvTimer.visibility = View.VISIBLE
            } else {
                tvTimer.visibility = View.GONE
            }

            val imgCard       = card.findViewById<ImageView>(R.id.imgFoodCard)
            val layoutNoImage = card.findViewById<LinearLayout>(R.id.layoutNoImage)

            if (!item.imageUri.isNullOrEmpty()) {
                try {
                    val imageSource: Any = when {
                        item.imageUri.startsWith("data:image") -> {
                            val base64 = item.imageUri.substringAfter("base64,")
                            val bytes  = android.util.Base64.decode(base64, android.util.Base64.NO_WRAP)
                            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        }
                        item.imageUri.startsWith("http") -> item.imageUri
                        item.imageUri.startsWith("/")    -> File(item.imageUri)
                        else -> item.imageUri
                    }
                    Glide.with(requireContext())
                        .load(imageSource)
                        .centerCrop()
                        .placeholder(android.R.drawable.ic_menu_gallery)
                        .error(android.R.drawable.ic_menu_gallery)
                        .into(imgCard)
                    imgCard.visibility       = View.VISIBLE
                    layoutNoImage.visibility = View.GONE
                } catch (e: Exception) {
                    imgCard.visibility       = View.GONE
                    layoutNoImage.visibility = View.VISIBLE
                }
            } else {
                imgCard.visibility       = View.GONE
                layoutNoImage.visibility = View.VISIBLE
            }

            // ✅ Claimed badge
            val tvCardClaimed = card.findViewById<TextView>(R.id.tvCardClaimed)
            if (item.isClaimed) {
                tvCardClaimed.visibility = View.VISIBLE
            } else {
                tvCardClaimed.visibility = View.GONE
            }

            // ✅ Fix: always allow clicking — FoodDetailActivity handles button state
            // Claimed food should still be openable so claimer can message donor
            card.setOnClickListener {
                val intent = Intent(requireContext(), FoodDetailActivity::class.java)
                intent.putExtra("item_id", item.id)
                startActivity(intent)
            }

            feedContainer.addView(card)
        }
    }
}