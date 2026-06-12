package com.sharebite.fragments

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.sharebite.R
import java.io.ByteArrayOutputStream
import java.util.UUID

class ShareFragment : Fragment() {

    private var selectedCategory = "Cooked Meal"
    private var selectedImageUri: Uri? = null
    private val auth = FirebaseAuth.getInstance()

    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            selectedImageUri = result.data?.data
            selectedImageUri?.let { uri ->
                val imgPreview     = view?.findViewById<ImageView>(R.id.imgPhotoPreview)
                val layoutAddPhoto = view?.findViewById<View>(R.id.layoutAddPhoto)
                val cardPreview    = view?.findViewById<View>(R.id.cardPhotoPreview)
                imgPreview?.setImageURI(uri)
                cardPreview?.visibility    = View.VISIBLE
                layoutAddPhoto?.visibility = View.GONE
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_share, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val etFoodName     = view.findViewById<EditText>(R.id.etFoodName)
        val etQuantity     = view.findViewById<EditText>(R.id.etQuantity)
        val etDescription  = view.findViewById<EditText>(R.id.etDescription)
        val etLocation     = view.findViewById<EditText>(R.id.etLocation)
        val etExpiryHours  = view.findViewById<EditText>(R.id.etExpiryHours)
        val etExpiryMins   = view.findViewById<EditText>(R.id.etExpiryMins)
        val switchAnon     = view.findViewById<SwitchCompat>(R.id.switchAnonymous)
        val btnShare       = view.findViewById<Button>(R.id.btnShare)
        val layoutAddPhoto = view.findViewById<View>(R.id.layoutAddPhoto)
        val imgPreview     = view.findViewById<ImageView>(R.id.imgPhotoPreview)
        val cardPreview    = view.findViewById<View>(R.id.cardPhotoPreview)

        layoutAddPhoto.setOnClickListener { openGallery() }
        imgPreview.setOnClickListener { openGallery() }

        val chipCookedMeal   = view.findViewById<LinearLayout>(R.id.chipCookedMeal)
        val chipFreshProduce = view.findViewById<LinearLayout>(R.id.chipFreshProduce)
        val chipPackaged     = view.findViewById<LinearLayout>(R.id.chipPackaged)
        val chipBakery       = view.findViewById<LinearLayout>(R.id.chipBakery)

        val categories = mapOf(
            chipCookedMeal   to "Cooked Meal",
            chipFreshProduce to "Fresh Produce",
            chipPackaged     to "Packaged",
            chipBakery       to "Bakery"
        )

        selectChip(chipCookedMeal, categories)

        categories.keys.forEach { chip ->
            chip.setOnClickListener {
                selectedCategory = categories[chip] ?: "Cooked Meal"
                selectChip(chip, categories)
            }
        }

        listOf(
            view.findViewById<TextView>(R.id.tagDairyFree),
            view.findViewById<TextView>(R.id.tagVegan),
            view.findViewById<TextView>(R.id.tagHalal)
        ).forEach { tag ->
            tag.visibility = View.GONE
        }

        btnShare.setOnClickListener {
            val foodName    = etFoodName.text.toString().trim()
            val quantity    = etQuantity.text.toString().trim()
            val description = etDescription.text.toString().trim()
            val location    = etLocation.text.toString().trim()
            val expiryHrs   = etExpiryHours.text.toString().trim().toLongOrNull() ?: 1L
            val expiryMins  = etExpiryMins.text.toString().trim().toLongOrNull() ?: 0L
            val isAnonymous = switchAnon.isChecked

            if (foodName.isEmpty()) {
                etFoodName.error = "Required!"
                etFoodName.requestFocus()
                return@setOnClickListener
            }
            if (quantity.isEmpty()) {
                etQuantity.error = "Required!"
                etQuantity.requestFocus()
                return@setOnClickListener
            }
            if (location.isEmpty()) {
                etLocation.error = "Required!"
                etLocation.requestFocus()
                return@setOnClickListener
            }

            val currentUser = auth.currentUser
            val userUid = if (isAnonymous) "" else (currentUser?.uid ?: "")

            val expiryMillis = System.currentTimeMillis() +
                    (expiryHrs * 3_600_000L) +
                    (expiryMins * 60_000L)

            btnShare.isEnabled = false
            btnShare.text = "Processing..."

            val base64Image = selectedImageUri?.let { convertToBase64(it) }

            fetchNameAndSave(
                isAnonymous, currentUser, userUid,
                foodName, quantity, description, location,
                base64Image, expiryMillis, btnShare
            )
        }
    }

    private fun convertToBase64(uri: Uri): String? {
        return try {
            val inputStream = requireContext().contentResolver.openInputStream(uri)
            val bytes = inputStream?.readBytes()
            inputStream?.close()

            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes!!.size)

            val resized = Bitmap.createScaledBitmap(bitmap, 400, 300, true)
            val outputStream = ByteArrayOutputStream()
            resized.compress(Bitmap.CompressFormat.JPEG, 60, outputStream)
            val compressedBytes = outputStream.toByteArray()

            "data:image/jpeg;base64," + android.util.Base64.encodeToString(
                compressedBytes, android.util.Base64.NO_WRAP
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchNameAndSave(
        isAnonymous: Boolean,
        currentUser: com.google.firebase.auth.FirebaseUser?,
        userUid: String,
        foodName: String,
        quantity: String,
        description: String,
        location: String,
        imageData: String?,
        expiryMillis: Long,
        btnShare: Button
    ) {
        if (isAnonymous || currentUser == null) {
            saveAndShare("Anonymous", userUid, foodName, quantity,
                description, location, imageData, expiryMillis, btnShare)
        } else {
            FirebaseDatabase
                .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
                .getReference("users")
                .child(currentUser.uid)
                .get()
                .addOnSuccessListener { snapshot ->
                    val realName = snapshot.child("name").getValue(String::class.java)
                        ?: currentUser.displayName
                        ?: currentUser.email?.substringBefore("@")
                        ?: "User"
                    saveAndShare(realName, userUid, foodName, quantity,
                        description, location, imageData, expiryMillis, btnShare)
                }
                .addOnFailureListener {
                    val fallbackName = currentUser.email?.substringBefore("@") ?: "User"
                    saveAndShare(fallbackName, userUid, foodName, quantity,
                        description, location, imageData, expiryMillis, btnShare)
                }
        }
    }

    private fun saveAndShare(
        displayName: String,
        userUid: String,
        foodName: String,
        quantity: String,
        description: String,
        location: String,
        imageData: String?,
        expiryMillis: Long,
        btnShare: Button
    ) {
        val newItem = FoodItem(
            id               = UUID.randomUUID().toString(),
            foodName         = foodName,
            quantity         = quantity,
            category         = selectedCategory,
            description      = description,
            location         = location,
            userName         = displayName,
            userUid          = userUid,
            imageUri         = imageData,
            expiryTimeMillis = expiryMillis,
            isClaimed        = false,
            claimedByUid     = ""
        )

        FoodDataStore.items.add(0, newItem)
        FoodDataStore.saveItem(newItem)

        if (!isAdded) return
        requireActivity().runOnUiThread {
            btnShare.isEnabled = true
            btnShare.text = "Share"
            Toast.makeText(requireContext(), "Food shared successfully! 🎉", Toast.LENGTH_SHORT).show()
            findNavController().navigate(R.id.feedFragment)
        }
    }

    private fun openGallery() {
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        intent.type = "image/*"
        imagePickerLauncher.launch(intent)
    }

    private fun selectChip(selected: LinearLayout, all: Map<LinearLayout, String>) {
        all.keys.forEach { chip ->
            val isSelected = (chip == selected)
            chip.background = ContextCompat.getDrawable(
                requireContext(),
                if (isSelected) R.drawable.bg_category_selected
                else R.drawable.bg_category_unselected
            )
            val textColor = if (isSelected) "#FFFFFF" else "#94A3B8"
            (chip.getChildAt(0) as? TextView)?.setTextColor(android.graphics.Color.parseColor(textColor))
        }
    }
}