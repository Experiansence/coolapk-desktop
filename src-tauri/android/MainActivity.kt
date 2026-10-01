package com.coolapk.desktop

import android.content.ClipData
import android.content.ContentUris
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.annotation.Keep
import androidx.core.content.FileProvider
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Android WebView 的 CSS safe-area 可能为 0，原生预留系统栏及刘海区域。
        val content = findViewById<View>(android.R.id.content)
        val safeAreaTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(safeAreaTypes)
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            // 已由父容器预留，避免 WebView 再次添加安全区；保留键盘等其他 inset。
            WindowInsetsCompat.Builder(insets)
                .setInsets(safeAreaTypes, Insets.NONE)
                .setInsetsIgnoringVisibility(safeAreaTypes, Insets.NONE)
                .build()
        }
        ViewCompat.requestApplyInsets(content)
    }

    private fun updateFile(path: String): File {
        val directory = File(filesDir, "coolapk-desktop-update").canonicalFile
        val file = File(path).canonicalFile
        require(file.parentFile == directory && file.isFile && file.length() > 0L && file.extension.equals("apk", true)) {
            "更新包不在应用更新目录内"
        }
        return file
    }

    private fun updateUri(value: String): Uri {
        val uri = Uri.parse(value)
        require(uri.scheme == "content" && uri.authority == MediaStore.AUTHORITY) { "更新包地址无效" }
        val id = ContentUris.parseId(uri)
        require(uri == ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id)) {
            "更新包不在系统下载目录"
        }
        contentResolver.query(
            uri,
            arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.OWNER_PACKAGE_NAME),
            null,
            null,
            null,
        ).use { cursor ->
            require(cursor != null && cursor.moveToFirst()) { "更新包已被删除" }
            val name = cursor.getString(0)
            val size = cursor.getLong(1)
            val owner = cursor.getString(2)
            require(name.matches(Regex("coolapk-v?[0-9].+-android-arm64\\.apk", RegexOption.IGNORE_CASE)) && size > 0L && owner == packageName) {
                "下载目录中的更新包无效"
            }
        }
        return uri
    }

    // Rust 通过 JNI 按名称调用，Release 混淆时必须保留方法名称和实现。
    @Keep
    fun publishUpdateApk(path: String): String = try {
        val file = updateFile(path)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            "private_fallback"
        } else {
            val displayName = file.name.replace(Regex("-\\d+-\\d+\\.apk$", RegexOption.IGNORE_CASE), ".apk")
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("无法在下载目录创建更新包")
            try {
                contentResolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } }
                    ?: throw IllegalStateException("无法写入下载目录")
                val ready = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
                contentResolver.update(uri, ready, null, null)
                uri.toString()
            } catch (error: Exception) {
                contentResolver.delete(uri, null, null)
                throw error
            }
        }
    } catch (error: Exception) {
        "error:${error.message ?: error.javaClass.simpleName}"
    }

    // 待安装包恢复也由 JNI 调用，不能被当作未使用的方法裁剪。
    @Keep
    fun isUpdatePackageAvailable(location: String): String = try {
        if (location.startsWith("content://")) updateUri(location) else updateFile(location)
        "available"
    } catch (_: Exception) {
        "missing"
    }

    // 保留系统安装器入口，避免下载成功后因方法被混淆而无法安装。
    @Keep
    fun launchUpdateInstaller(location: String): String = try {
        val uri = if (location.startsWith("content://")) {
            updateUri(location)
        } else {
            FileProvider.getUriForFile(this, "$packageName.fileprovider", updateFile(location))
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            "permission_required"
        } else {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                clipData = ClipData.newRawUri("更新包", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(intent)
            "started"
        }
    } catch (error: Exception) {
        "error:${error.message ?: error.javaClass.simpleName}"
    }
}
