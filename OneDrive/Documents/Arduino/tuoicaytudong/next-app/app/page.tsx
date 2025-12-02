"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import mqtt, { MqttClient } from "mqtt";
import axios from "axios";
import toast from "react-hot-toast";
import { useSystemStore, WateringSchedule } from "@/store/useSystemStore";

type SensorPayload = {
  humidity: number;
  analog_value: number;
  timestamp: number;
};

// MQTT Configuration từ .env
const MQTT_CONFIG = {
  host:
    process.env.NEXT_PUBLIC_MQTT_HOST ||
    "rf19001d.ala.asia-southeast1.emqxsl.com",
  port: parseInt(process.env.NEXT_PUBLIC_MQTT_PORT || "8084"),
  protocol: (process.env.NEXT_PUBLIC_MQTT_PROTOCOL || "wss") as "ws" | "wss",
  username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "dhieu9b",
  password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "0383853356",
};

const TOPICS = {
  command: process.env.NEXT_PUBLIC_MQTT_TOPIC_COMMAND || "tuoicay/command",
  status: process.env.NEXT_PUBLIC_MQTT_TOPIC_STATUS || "tuoicay/status",
  sensor: process.env.NEXT_PUBLIC_MQTT_TOPIC_SENSOR || "tuoicay/sensor",
};

export default function Page() {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [sensor, setSensor] = useState<SensorPayload | null>(null);
  const [newScheduleHour, setNewScheduleHour] = useState(7);
  const [newScheduleMinute, setNewScheduleMinute] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Zustand store
  const {
    pumpStatus,
    threshold,
    wateringDuration,
    autoMode,
    isRaining,
    scheduleEnabled,
    delayedWateringEnabled,
    delayedWateringHours,
    delayedWateringMinutes,
    schedules,
    setPumpStatus,
    setThreshold,
    setWateringDuration,
    setAutoMode,
    setIsRaining,
    setScheduleEnabled,
    setDelayedWatering,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    loadState,
  } = useSystemStore();

  // Load state từ SQLite khi mount
  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MQTT connection với auto-reconnect
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isManualDisconnect = false;
    let retryCount = 0;
    let currentClient: MqttClient | null = null;
    const MAX_RETRY_ATTEMPTS = 10; // Tối đa 10 lần thử
    const INITIAL_RECONNECT_DELAY = 2000; // 2 giây
    const MAX_RECONNECT_DELAY = 30000; // 30 giây

    const connectMQTT = () => {
      // Đóng client cũ nếu có
      if (currentClient) {
        try {
          currentClient.end(true);
        } catch (e) {
          console.error("Error closing old client:", e);
        }
      }

      const url = `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;
      const c = mqtt.connect(url, {
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        reconnectPeriod: 0, // Tắt auto-reconnect mặc định, tự quản lý
        connectTimeout: 10000,
        keepalive: 60,
        clean: true,
      });

      currentClient = c;

      c.on("connect", () => {
        console.log("MQTT connected successfully");
        setConnected(true);
        setIsReconnecting(false);
        setReconnectAttempts(0);
        retryCount = 0;

        // Subscribe lại topics
        c.subscribe([TOPICS.status, TOPICS.sensor], (err) => {
          if (err) {
            console.error("Subscribe error:", err);
            toast.error("Lỗi đăng ký topics MQTT");
          } else {
            console.log("Subscribed to topics:", TOPICS.status, TOPICS.sensor);
            if (retryCount > 0) {
              toast.success("Đã kết nối lại MQTT thành công");
            } else {
              toast.success("Đã kết nối MQTT thành công");
            }
          }
        });
      });

      c.on("error", (error) => {
        console.error("MQTT error:", error);
        setConnected(false);

        if (!isManualDisconnect) {
          setIsReconnecting(true);
          toast.error(`Lỗi kết nối MQTT: ${error.message || "Unknown"}`, {
            duration: 3000,
          });
        }
      });

      c.on("close", () => {
        console.log("MQTT connection closed");
        setConnected(false);

        if (!isManualDisconnect) {
          setIsReconnecting(true);

          // Tự động reconnect với exponential backoff
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * Math.pow(2, retryCount),
              MAX_RECONNECT_DELAY
            );

            retryCount++;
            setReconnectAttempts(retryCount);

            console.log(
              `Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRY_ATTEMPTS})`
            );

            toast(
              `Đang kết nối lại MQTT... (Lần thử: ${retryCount}/${MAX_RETRY_ATTEMPTS})`,
              {
                icon: "🔄",
                duration: delay,
              }
            );

            reconnectTimer = setTimeout(() => {
              if (!isManualDisconnect) {
                console.log("Attempting to reconnect...");
                connectMQTT(); // Reconnect (sẽ tự đóng client cũ)
              }
            }, delay);
          } else {
            // Đã thử quá nhiều lần
            setIsReconnecting(false);
            toast.error(
              "Không thể kết nối MQTT sau nhiều lần thử. Vui lòng tải lại trang.",
              {
                duration: 5000,
              }
            );
          }
        }
      });

      c.on("offline", () => {
        console.log("MQTT client went offline");
        setConnected(false);
        setIsReconnecting(true);

        if (!isManualDisconnect && retryCount === 0) {
          toast.error("Mất kết nối MQTT, đang thử kết nối lại...", {
            icon: "🔄",
          });
        }
      });

      c.on("reconnect", () => {
        console.log("MQTT reconnecting...");
        setIsReconnecting(true);
        setReconnectAttempts((prev) => prev + 1);
      });

      c.on("message", (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          if (topic === TOPICS.status) {
            // Sync với Zustand store
            if (data.pump_status !== undefined) setPumpStatus(data.pump_status);
            if (data.threshold !== undefined) setThreshold(data.threshold);
            if (data.watering_duration !== undefined)
              setWateringDuration(data.watering_duration);
            if (data.auto_mode !== undefined) setAutoMode(data.auto_mode);
            if (data.is_raining !== undefined) setIsRaining(data.is_raining);
            if (data.schedule_enabled !== undefined)
              setScheduleEnabled(data.schedule_enabled);
            if (
              data.delayed_watering_enabled !== undefined &&
              data.delay_hours !== undefined &&
              data.delay_minutes !== undefined
            ) {
              setDelayedWatering(
                data.delayed_watering_enabled,
                data.delay_hours,
                data.delay_minutes
              );
            }
            // Log status vào SQLite
            const currentState = useSystemStore.getState();
            axios
              .post("/api/logs/status", {
                pump_status: data.pump_status ?? currentState.pumpStatus,
                threshold: data.threshold ?? currentState.threshold,
                watering_duration:
                  data.watering_duration ?? currentState.wateringDuration,
                auto_mode: data.auto_mode ?? currentState.autoMode,
                is_raining: data.is_raining ?? currentState.isRaining,
                delayed_watering_enabled:
                  data.delayed_watering_enabled ??
                  currentState.delayedWateringEnabled,
                delayed_watering_hours:
                  data.delay_hours ?? currentState.delayedWateringHours,
                delayed_watering_minutes:
                  data.delay_minutes ?? currentState.delayedWateringMinutes,
              })
              .catch(() => {});
          } else if (topic === TOPICS.sensor) {
            setSensor(data);
            // Log sensor vào SQLite
            axios.post("/api/logs/sensor", data).catch(() => {});
          }
        } catch {
          // ignore
        }
      });

      setClient(c);
    };

    // Khởi tạo kết nối
    connectMQTT();

    // Cleanup function
    return () => {
      isManualDisconnect = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (currentClient) {
        try {
          currentClient.end(true);
        } catch (e) {
          console.error("Error closing client on cleanup:", e);
        }
      }
    };
  }, [
    setPumpStatus,
    setThreshold,
    setWateringDuration,
    setAutoMode,
    setIsRaining,
    setScheduleEnabled,
    setDelayedWatering,
  ]);

  function publishCommand(payload: object, successMessage?: string) {
    if (!client || !connected) {
      toast.error("Chưa kết nối MQTT!");
      return;
    }
    try {
      client.publish(TOPICS.command, JSON.stringify(payload));
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error("Không thể gửi lệnh đến ESP32");
    }
  }

  // Convert schedules sang format ESP32 (schedule_hour_1/2, schedule_minute_1/2)
  function syncSchedulesToESP32() {
    const enabledSchedules = schedules.filter((s) => s.enabled);
    const schedule1 = enabledSchedules[0] || { hour: 0, minute: 0 };
    const schedule2 = enabledSchedules[1] || { hour: 0, minute: 0 };

    publishCommand(
      {
        schedule_enabled: scheduleEnabled,
        schedule_hour_1: schedule1.hour,
        schedule_minute_1: schedule1.minute,
        schedule_hour_2: schedule2.hour,
        schedule_minute_2: schedule2.minute,
      },
      `Đã đồng bộ ${enabledSchedules.length} lịch tưới với ESP32`
    );
  }

  // Debounced sync function - chờ 2 giây sau khi cập nhật
  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncSchedulesRef = useRef(syncSchedulesToESP32);

  // Cập nhật ref mỗi khi function thay đổi
  useEffect(() => {
    syncSchedulesRef.current = syncSchedulesToESP32;
  }, [schedules, scheduleEnabled]);

  const debouncedSyncSchedules = useCallback(() => {
    // Clear timer cũ nếu có
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }

    // Đặt timer mới - sau 2 giây mới sync với ESP32
    syncDebounceTimerRef.current = setTimeout(() => {
      syncSchedulesRef.current(); // Sử dụng ref để đảm bảo có giá trị mới nhất
      syncDebounceTimerRef.current = null;
    }, 2000);
  }, []);

  const humidity = sensor?.humidity ?? undefined;

  return (
    <div className="space-y-4">
      <header className="text-center text-white space-y-2">
        <h1 className="text-2xl font-semibold">🌱 Tưới Cây Tự Động</h1>
        <span
          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
            connected
              ? "bg-emerald-500"
              : isReconnecting
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        >
          {connected
            ? "Đã kết nối MQTT"
            : isReconnecting
            ? `Đang kết nối lại... (${reconnectAttempts})`
            : "Mất kết nối MQTT"}
        </span>
      </header>

      {/* Độ ẩm đất */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">💧</span>
          <span className="font-semibold">Độ Ẩm Đất</span>
        </div>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-center text-white py-4">
          <div className="text-xs opacity-80">Độ ẩm hiện tại</div>
          <div className="text-4xl font-bold">
            {humidity !== undefined ? humidity.toFixed(1) : "--"}
          </div>
          <div className="text-xs opacity-80">
            % (0% = rất khô, 100% = rất ướt)
          </div>
        </div>
      </section>

      {/* Ngưỡng độ ẩm */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">⚙️</span>
          <span className="font-semibold">Ngưỡng Độ Ẩm</span>
        </div>
        <div className="text-xs text-slate-500 flex justify-between">
          <span>Mùa khô: ~40%</span>
          <span>Mùa mưa: ~60%</span>
        </div>
        <input
          type="range"
          min={20}
          max={80}
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-indigo-600 text-2xl font-semibold">
          {threshold}%
        </div>
        <button
          onClick={async () => {
            publishCommand({ threshold }, "Đã gửi lệnh cập nhật ngưỡng độ ẩm");
            // Lưu vào SQLite khi nhấn nút
            try {
              await useSystemStore.getState().saveState();
              toast.success("Đã lưu ngưỡng độ ẩm vào cơ sở dữ liệu");
            } catch (error) {
              toast.error("Không thể lưu ngưỡng độ ẩm");
            }
          }}
          className="w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
        >
          Cập nhật ngưỡng
        </button>
      </section>

      {/* Điều khiển bơm & chế độ */}
      <section className="grid grid-cols-1 gap-4">
        <div className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="text-xl">🔧</span>
            <span className="font-semibold">Điều Khiển Bơm</span>
          </div>
          <div className="text-center">
            <span
              className={`inline-flex px-4 py-1 rounded-full text-sm font-semibold ${
                pumpStatus
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-500 text-white"
              }`}
            >
              Bơm: {pumpStatus ? "BẬT" : "TẮT"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={autoMode}
              onClick={() => {
                if (autoMode) {
                  toast(
                    "Đang ở AUTO mode, không thể bật/tắt bơm thủ công. Hãy chuyển sang Manual mode trước.",
                    { icon: "ℹ️" }
                  );
                  return;
                }
                // Optimistic update: cập nhật UI ngay lập tức
                setPumpStatus(true);
                publishCommand({ pump: "on" }, "Đã gửi lệnh BẬT bơm");
              }}
              className="py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              BẬT BƠM
            </button>
            <button
              disabled={autoMode}
              onClick={() => {
                if (autoMode) {
                  toast(
                    "Đang ở AUTO mode, không thể bật/tắt bơm thủ công. Hãy chuyển sang Manual mode trước.",
                    { icon: "ℹ️" }
                  );
                  return;
                }
                // Optimistic update: cập nhật UI ngay lập tức
                setPumpStatus(false);
                publishCommand({ pump: "off" }, "Đã gửi lệnh TẮT bơm");
              }}
              className="py-2 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50"
            >
              TẮT BƠM
            </button>
          </div>
          {autoMode && (
            <p className="text-xs text-slate-500 text-center">
              Đang ở AUTO mode, không thể bật/tắt thủ công.
            </p>
          )}
        </div>

        <div className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="text-xl">⚙️</span>
            <span className="font-semibold">Chế Độ Vận Hành</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Tự động (Auto mode)</span>
            <button
              onClick={() => {
                const next = !autoMode;
                setAutoMode(next);
                publishCommand(
                  { auto_mode: next },
                  `Đã chuyển sang ${next ? "AUTO" : "MANUAL"} mode`
                );
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                autoMode
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-400 text-white"
              }`}
            >
              {autoMode ? "AUTO" : "MANUAL"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            - Auto: hệ thống tự bật/tắt bơm theo độ ẩm, lịch tưới, trạng thái
            mưa.
            <br />- Manual: bạn tự điều khiển bơm, logic tự động tạm tắt.
          </p>
        </div>
      </section>

      {/* Thời gian tưới */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">⏰</span>
          <span className="font-semibold">Thời Gian Tưới</span>
        </div>
        <input
          type="range"
          min={30}
          max={300}
          step={10}
          value={wateringDuration}
          onChange={(e) => setWateringDuration(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-indigo-600 text-xl font-semibold">
          {wateringDuration} giây
        </div>
        <button
          onClick={() =>
            publishCommand(
              { watering_duration: wateringDuration },
              `Đã cập nhật thời gian tưới: ${wateringDuration} giây`
            )
          }
          className="w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold"
        >
          Cập nhật
        </button>
      </section>

      {/* Tưới định kỳ theo khoảng thời gian */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">⏳</span>
          <span className="font-semibold">
            Tưới Định Kỳ Theo Khoảng Thời Gian
          </span>
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span>Sau:</span>
            <input
              type="number"
              min={0}
              max={23}
              value={delayedWateringHours}
              onChange={(e) =>
                setDelayedWatering(
                  delayedWateringEnabled,
                  parseInt(e.target.value || "0"),
                  delayedWateringMinutes
                )
              }
              className="w-16 border rounded-lg px-2 py-1 text-center"
            />
            <span>giờ</span>
            <input
              type="number"
              min={0}
              max={59}
              value={delayedWateringMinutes}
              onChange={(e) =>
                setDelayedWatering(
                  delayedWateringEnabled,
                  delayedWateringHours,
                  parseInt(e.target.value || "0")
                )
              }
              className="w-16 border rounded-lg px-2 py-1 text-center"
            />
            <span>phút</span>
          </div>
          <p className="text-xs text-slate-500">
            Hệ thống sẽ thử tưới SAU MỖI khoảng thời gian đặt (lặp lại) nếu đất
            khô và không mưa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={() => {
              if (delayedWateringHours === 0 && delayedWateringMinutes === 0) {
                toast.error("Vui lòng nhập thời gian lớn hơn 0");
                return;
              }
              setDelayedWatering(
                true,
                delayedWateringHours,
                delayedWateringMinutes
              );
              publishCommand(
                {
                  delay_hours: delayedWateringHours,
                  delay_minutes: delayedWateringMinutes,
                },
                `Đã đặt lịch tưới định kỳ: sau ${delayedWateringHours}h ${delayedWateringMinutes}m`
              );
            }}
            className="py-2 rounded-xl bg-indigo-600 text-white font-semibold"
          >
            Đặt Lịch Tưới Định Kỳ
          </button>
          <button
            onClick={() => {
              setDelayedWatering(false, 0, 0);
              publishCommand(
                { delay_hours: 0, delay_minutes: 0 },
                "Đã hủy lịch tưới định kỳ"
              );
            }}
            className="py-2 rounded-xl bg-slate-500 text-white font-semibold"
          >
            Hủy Lịch
          </button>
        </div>
      </section>

      {/* Lịch tưới tự động - có thể thêm nhiều */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="text-xl">📅</span>
            <span className="font-semibold">Lịch Tưới Tự Động</span>
          </div>
          <button
            onClick={syncSchedulesToESP32}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg"
          >
            Đồng bộ ESP32
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">Bật lịch tưới</span>
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => {
              setScheduleEnabled(e.target.checked);
              syncSchedulesToESP32();
              toast(
                e.target.checked
                  ? "Đã bật lịch tưới tự động"
                  : "Đã tắt lịch tưới tự động",
                { icon: "ℹ️" }
              );
            }}
          />
        </div>

        {/* Danh sách lịch tưới */}
        <div className="space-y-2 mt-2">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center gap-2 p-2 border rounded-lg"
            >
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) =>
                  updateSchedule(schedule.id!, {
                    enabled: e.target.checked,
                  }).then(() => syncSchedulesToESP32())
                }
                className="mr-2"
              />
              <input
                type="number"
                min={0}
                max={23}
                value={schedule.hour}
                onChange={async (e) => {
                  // Cập nhật database ngay lập tức
                  await updateSchedule(schedule.id!, {
                    hour: parseInt(e.target.value || "0"),
                  });
                  // Debounce: chờ 2 giây mới sync với ESP32
                  debouncedSyncSchedules();
                }}
                className="w-16 border rounded px-2 py-1 text-center"
              />
              <span>giờ</span>
              <input
                type="number"
                min={0}
                max={59}
                value={schedule.minute}
                onChange={async (e) => {
                  // Cập nhật database ngay lập tức
                  await updateSchedule(schedule.id!, {
                    minute: parseInt(e.target.value || "0"),
                  });
                  // Debounce: chờ 2 giây mới sync với ESP32
                  debouncedSyncSchedules();
                }}
                className="w-16 border rounded px-2 py-1 text-center"
              />
              <span>phút</span>
              <button
                onClick={() =>
                  deleteSchedule(schedule.id!).then(() =>
                    syncSchedulesToESP32()
                  )
                }
                className="ml-auto px-2 py-1 text-xs bg-red-500 text-white rounded"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>

        {/* Thêm lịch mới */}
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span>Thêm lịch mới:</span>
            <input
              type="number"
              min={0}
              max={23}
              value={newScheduleHour}
              onChange={(e) =>
                setNewScheduleHour(parseInt(e.target.value || "0"))
              }
              className="w-16 border rounded px-2 py-1 text-center"
            />
            <span>giờ</span>
            <input
              type="number"
              min={0}
              max={59}
              value={newScheduleMinute}
              onChange={(e) =>
                setNewScheduleMinute(parseInt(e.target.value || "0"))
              }
              className="w-16 border rounded px-2 py-1 text-center"
            />
            <span>phút</span>
            <button
              onClick={async () => {
                await addSchedule({
                  hour: newScheduleHour,
                  minute: newScheduleMinute,
                  enabled: true,
                });
                syncSchedulesToESP32();
                setNewScheduleHour(7);
                setNewScheduleMinute(0);
              }}
              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded"
            >
              Thêm
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Tưới vào giờ và phút đã đặt nếu đất khô và không mưa. Có thể thêm
          nhiều lịch tưới.
        </p>
      </section>

      {/* Trạng thái mưa */}
      <section className="card bg-white/95 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">🌧️</span>
          <span className="font-semibold">Trạng Thái Mưa</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">
            Đang mưa / Dự báo mưa (bật để skip mọi lịch tưới)
          </span>
          <input
            type="checkbox"
            checked={isRaining}
            onChange={(e) => {
              const value = e.target.checked;
              setIsRaining(value);
              publishCommand(
                { is_raining: value },
                value ? "Đã bật trạng thái mưa" : "Đã tắt trạng thái mưa"
              );
            }}
          />
        </div>
      </section>
    </div>
  );
}
