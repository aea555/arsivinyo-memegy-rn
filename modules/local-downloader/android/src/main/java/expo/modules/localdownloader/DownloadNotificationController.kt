package expo.modules.localdownloader

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat

internal data class BackgroundNotificationState(
  val activeTaskId: String?,
  val phase: String,
  val message: String?,
  val progressPercent: Double?,
  val queueSize: Int,
  val nsfwDefault: Boolean,
  val anonymousDefault: Boolean,
  val saveToDeviceDefault: Boolean,
  val pinned: Boolean = false,
) {
  val hasWork: Boolean
    get() = !activeTaskId.isNullOrBlank() || queueSize > 0

  val shouldRunForeground: Boolean
    get() = hasWork || pinned
}

internal object DownloadNotificationController {
  const val CHANNEL_ID = "arsivinyo_downloads"
  const val NOTIFICATION_ID = 7441

  const val ACTION_SYNC = "expo.modules.localdownloader.action.NOTIFICATION_SYNC"
  const val ACTION_STOP = "expo.modules.localdownloader.action.NOTIFICATION_STOP"
  const val REMOTE_INPUT_URL_KEY = "remote_input_url"

  private const val EXTRA_ACTIVE_TASK_ID = "extra_active_task_id"
  private const val EXTRA_PHASE = "extra_phase"
  private const val EXTRA_MESSAGE = "extra_message"
  private const val EXTRA_PROGRESS_PERCENT = "extra_progress_percent"
  private const val EXTRA_QUEUE_SIZE = "extra_queue_size"
  private const val EXTRA_NSFW_DEFAULT = "extra_nsfw_default"
  private const val EXTRA_ANONYMOUS_DEFAULT = "extra_anonymous_default"
  private const val EXTRA_SAVE_TO_DEVICE_DEFAULT = "extra_save_to_device_default"
  private const val EXTRA_PINNED = "extra_pinned"

  fun startOrUpdate(context: Context, state: BackgroundNotificationState) {
    ensureChannel(context)
    val intent = Intent(context, DownloadForegroundService::class.java).apply {
      action = ACTION_SYNC
      putExtra(EXTRA_ACTIVE_TASK_ID, state.activeTaskId)
      putExtra(EXTRA_PHASE, state.phase)
      putExtra(EXTRA_MESSAGE, state.message)
      putExtra(EXTRA_PROGRESS_PERCENT, state.progressPercent)
      putExtra(EXTRA_QUEUE_SIZE, state.queueSize)
      putExtra(EXTRA_NSFW_DEFAULT, state.nsfwDefault)
      putExtra(EXTRA_ANONYMOUS_DEFAULT, state.anonymousDefault)
      putExtra(EXTRA_SAVE_TO_DEVICE_DEFAULT, state.saveToDeviceDefault)
      putExtra(EXTRA_PINNED, state.pinned)
    }
    ContextCompat.startForegroundService(context, intent)
  }

  fun stop(context: Context) {
    val intent = Intent(context, DownloadForegroundService::class.java).apply {
      action = ACTION_STOP
    }
    context.startService(intent)
  }

  fun parseState(intent: Intent?): BackgroundNotificationState {
    return BackgroundNotificationState(
      activeTaskId = intent?.getStringExtra(EXTRA_ACTIVE_TASK_ID),
      phase = intent?.getStringExtra(EXTRA_PHASE).orEmpty().ifBlank { "idle" },
      message = intent?.getStringExtra(EXTRA_MESSAGE),
      progressPercent = intent?.getDoubleExtra(EXTRA_PROGRESS_PERCENT, Double.NaN)?.takeIf { !it.isNaN() },
      queueSize = intent?.getIntExtra(EXTRA_QUEUE_SIZE, 0) ?: 0,
      nsfwDefault = intent?.getBooleanExtra(EXTRA_NSFW_DEFAULT, false) ?: false,
      anonymousDefault = intent?.getBooleanExtra(EXTRA_ANONYMOUS_DEFAULT, false) ?: false,
      saveToDeviceDefault = intent?.getBooleanExtra(EXTRA_SAVE_TO_DEVICE_DEFAULT, true) ?: true,
      pinned = intent?.getBooleanExtra(EXTRA_PINNED, false) ?: false,
    )
  }

  fun buildNotification(context: Context, state: BackgroundNotificationState): Notification {
    ensureChannel(context)

    val hasActiveTask = !state.activeTaskId.isNullOrBlank()
    val title = when {
      hasActiveTask -> context.getString(R.string.local_downloader_notif_title_downloading)
      state.queueSize > 0 -> context.getString(R.string.local_downloader_notif_title_queued)
      else -> context.getString(R.string.local_downloader_notif_title_idle)
    }
    val subtitle = state.message?.takeIf { it.isNotBlank() }
      ?: when (state.phase) {
        "starting" -> context.getString(R.string.local_downloader_notif_subtitle_starting)
        "downloading" -> context.getString(R.string.local_downloader_notif_subtitle_downloading)
        "processing" -> context.getString(R.string.local_downloader_notif_subtitle_processing)
        "saving" -> context.getString(R.string.local_downloader_notif_subtitle_saving)
        "completed" -> context.getString(R.string.local_downloader_notif_subtitle_completed)
        "error" -> context.getString(R.string.local_downloader_notif_subtitle_error)
        else -> if (state.queueSize > 0) {
          context.getString(R.string.local_downloader_notif_subtitle_queue_clipboard)
        } else {
          context.getString(R.string.local_downloader_notif_subtitle_tap_clipboard)
        }
      }
    val queueLabel = context.getString(R.string.local_downloader_notif_queue_label, state.queueSize, 3)
    val modeLabel = context.getString(
      R.string.local_downloader_notif_toggle_summary,
      if (state.nsfwDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off),
      if (state.anonymousDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off),
      if (state.saveToDeviceDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off),
    )

    val progress = state.progressPercent?.toInt()?.coerceIn(0, 100)
    val showIndeterminate = hasActiveTask && (state.phase == "starting" || state.phase == "processing" || progress == null)
    val progressText = when {
      showIndeterminate -> context.getString(R.string.local_downloader_notif_progress_indeterminate)
      hasActiveTask -> context.getString(R.string.local_downloader_notif_progress_percent, progress ?: 0)
      state.queueSize > 0 -> context.getString(R.string.local_downloader_notif_progress_queued)
      else -> context.getString(R.string.local_downloader_notif_progress_idle)
    }

    val collapsed = RemoteViews(context.packageName, R.layout.local_downloader_notification_collapsed).apply {
      setTextViewText(R.id.notification_title, title)
      setTextViewText(R.id.notification_subtitle, subtitle)
      setTextViewText(R.id.notification_queue, queueLabel)
      setTextViewText(R.id.notification_mode, modeLabel)
      if (showIndeterminate) {
        setProgressBar(R.id.notification_progress, 100, 0, true)
        setTextViewText(R.id.notification_progress_text, progressText)
      } else {
        setProgressBar(R.id.notification_progress, 100, progress ?: 0, false)
        setTextViewText(R.id.notification_progress_text, progressText)
      }
      setOnClickPendingIntent(R.id.notification_action_quick, buildQuickCapturePendingIntent(context, 40))
      setOnClickPendingIntent(R.id.notification_action_nsfw, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_NSFW, 45))
      setOnClickPendingIntent(R.id.notification_action_anonymous, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_ANONYMOUS, 46))
      setOnClickPendingIntent(R.id.notification_action_save, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_SAVE_TO_DEVICE, 47))
      setTextViewText(
        R.id.notification_action_nsfw,
        context.getString(
          R.string.local_downloader_notif_toggle_nsfw,
          if (state.nsfwDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
      setTextViewText(
        R.id.notification_action_anonymous,
        context.getString(
          R.string.local_downloader_notif_toggle_anonymous,
          if (state.anonymousDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
      setTextViewText(
        R.id.notification_action_save,
        context.getString(
          R.string.local_downloader_notif_toggle_save,
          if (state.saveToDeviceDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
    }

    val expanded = RemoteViews(context.packageName, R.layout.local_downloader_notification_expanded).apply {
      setTextViewText(R.id.notification_title, title)
      setTextViewText(R.id.notification_subtitle, subtitle)
      setTextViewText(R.id.notification_queue, queueLabel)
      setTextViewText(R.id.notification_mode, modeLabel)
      if (showIndeterminate) {
        setProgressBar(R.id.notification_progress, 100, 0, true)
        setTextViewText(R.id.notification_progress_text, progressText)
      } else {
        setProgressBar(R.id.notification_progress, 100, progress ?: 0, false)
        setTextViewText(R.id.notification_progress_text, progressText)
      }
      if (hasActiveTask) {
        setViewVisibility(R.id.notification_action_cancel, android.view.View.VISIBLE)
        setOnClickPendingIntent(R.id.notification_action_cancel, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_CANCEL_ACTIVE, 41))
      } else {
        setViewVisibility(R.id.notification_action_cancel, android.view.View.GONE)
      }
      setOnClickPendingIntent(R.id.notification_action_quick, buildQuickCapturePendingIntent(context, 42))
      setOnClickPendingIntent(R.id.notification_action_nsfw, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_NSFW, 48))
      setOnClickPendingIntent(R.id.notification_action_anonymous, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_ANONYMOUS, 49))
      setOnClickPendingIntent(R.id.notification_action_save, buildActionPendingIntent(context, DownloadActionReceiver.ACTION_TOGGLE_SAVE_TO_DEVICE, 50))
      setTextViewText(
        R.id.notification_action_nsfw,
        context.getString(
          R.string.local_downloader_notif_toggle_nsfw,
          if (state.nsfwDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
      setTextViewText(
        R.id.notification_action_anonymous,
        context.getString(
          R.string.local_downloader_notif_toggle_anonymous,
          if (state.anonymousDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
      setTextViewText(
        R.id.notification_action_save,
        context.getString(
          R.string.local_downloader_notif_toggle_save,
          if (state.saveToDeviceDefault) context.getString(R.string.local_downloader_toggle_on) else context.getString(R.string.local_downloader_toggle_off)
        )
      )
    }

    val addUrlRemoteInput = RemoteInput.Builder(REMOTE_INPUT_URL_KEY)
      .setLabel(context.getString(R.string.local_downloader_notif_add_url_label))
      .build()
    val addUrlAction = NotificationCompat.Action.Builder(
      android.R.drawable.ic_input_add,
      context.getString(R.string.local_downloader_notif_add_url_action),
      buildMutableActionPendingIntent(context, DownloadActionReceiver.ACTION_ADD_URL_REMOTE_INPUT, 44)
    )
      .addRemoteInput(addUrlRemoteInput)
      .setAllowGeneratedReplies(false)
      .build()

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(subtitle)
      .setOngoing(state.shouldRunForeground)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(collapsed)
      .setCustomBigContentView(expanded)
      .setContentIntent(buildQuickCapturePendingIntent(context, 43))
      .addAction(addUrlAction)
      .setAutoCancel(false)
      .build()
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.local_downloader_channel_name),
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = context.getString(R.string.local_downloader_channel_description)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildQuickCapturePendingIntent(context: Context, requestCode: Int): PendingIntent {
    val intent = Intent(context, QuickDownloadCaptureActivity::class.java).apply {
      putExtra(QuickDownloadCaptureActivity.EXTRA_AUTOSTART, true)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildActionPendingIntent(context: Context, action: String, requestCode: Int): PendingIntent {
    val actionIntent = Intent(context, DownloadActionReceiver::class.java).apply {
      this.action = action
      setPackage(context.packageName)
    }

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      actionIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildMutableActionPendingIntent(context: Context, action: String, requestCode: Int): PendingIntent {
    val actionIntent = Intent(context, DownloadActionReceiver::class.java).apply {
      this.action = action
      setPackage(context.packageName)
    }

    val mutabilityFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      actionIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag
    )
  }
}
