package com.almasry.elec;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Hosts the offline calculator page (assets/index.html) in a WebView. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // keeps the user's last inputs
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /** Page -> Android: clipboard copy and saving the exported Excel file. */
    private class Bridge {
        /** Saves the exported workbook to Downloads (Android 10+) or the app's files folder, then offers to open it. */
        @JavascriptInterface
        public void saveFile(String name, String base64) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                final Uri uri;
                final String where;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, XLSX);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Spark");
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("MediaStore insert failed");
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(data); }
                    where = "Download/Spark/" + name;
                } else {
                    File f = new File(getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), name);
                    try (OutputStream o = new FileOutputStream(f)) { o.write(data); }
                    uri = null;
                    where = f.getAbsolutePath();
                }
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "تم الحفظ: " + where, Toast.LENGTH_LONG).show();
                    if (uri == null) return;
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, XLSX)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, name));
                    } catch (Exception ignored) { /* no spreadsheet app installed */ }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تعذّر حفظ الملف: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }


        @JavascriptInterface
        public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("result", text));
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم النسخ", Toast.LENGTH_SHORT).show());
        }
    }
}
