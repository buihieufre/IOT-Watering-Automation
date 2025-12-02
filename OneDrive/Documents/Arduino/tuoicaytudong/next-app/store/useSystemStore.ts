import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

export interface WateringSchedule {
  id?: number;
  hour: number;
  minute: number;
  enabled: boolean;
}

interface SystemState {
  // Trạng thái hệ thống
  pumpStatus: boolean;
  threshold: number;
  wateringDuration: number; // giây
  autoMode: boolean;
  isRaining: boolean;
  scheduleEnabled: boolean;

  // Lịch tưới định kỳ (delay)
  delayedWateringEnabled: boolean;
  delayedWateringHours: number;
  delayedWateringMinutes: number;

  // Danh sách lịch tưới tự động (có thể thêm nhiều)
  schedules: WateringSchedule[];

  // Actions
  setPumpStatus: (status: boolean) => void;
  setThreshold: (value: number) => void;
  setWateringDuration: (value: number) => void;
  setAutoMode: (value: boolean) => void;
  setIsRaining: (value: boolean) => void;
  setScheduleEnabled: (value: boolean) => void;
  setDelayedWatering: (
    enabled: boolean,
    hours: number,
    minutes: number
  ) => void;

  // Lịch tưới
  addSchedule: (schedule: Omit<WateringSchedule, "id">) => Promise<void>;
  updateSchedule: (
    id: number,
    schedule: Partial<WateringSchedule>
  ) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
  setSchedules: (schedules: WateringSchedule[]) => void;

  // Load/Save từ server
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  // Initial state
  pumpStatus: false,
  threshold: 50,
  wateringDuration: 60,
  autoMode: true,
  isRaining: false,
  scheduleEnabled: true,
  delayedWateringEnabled: false,
  delayedWateringHours: 0,
  delayedWateringMinutes: 10,
  schedules: [],

  // Setters
  setPumpStatus: (status) => {
    set({ pumpStatus: status });
    get().saveState();
  },
  setThreshold: (value) => {
    set({ threshold: value });
    // Không tự động save, chỉ update UI state
  },
  setWateringDuration: (value) => {
    set({ wateringDuration: value });
    get().saveState();
  },
  setAutoMode: (value) => {
    set({ autoMode: value });
    get().saveState();
  },
  setIsRaining: (value) => {
    set({ isRaining: value });
    get().saveState();
  },
  setScheduleEnabled: (value) => {
    set({ scheduleEnabled: value });
    get().saveState();
  },
  setDelayedWatering: (enabled, hours, minutes) => {
    set({
      delayedWateringEnabled: enabled,
      delayedWateringHours: hours,
      delayedWateringMinutes: minutes,
    });
    get().saveState();
  },

  // Schedule management
  addSchedule: async (schedule) => {
    try {
      const res = await axios.post("/api/schedules", schedule);
      const newSchedule = res.data;
      set((state) => ({
        schedules: [...state.schedules, newSchedule],
      }));
      get().saveState();
      toast.success(
        `Đã thêm lịch tưới lúc ${schedule.hour}:${schedule.minute
          .toString()
          .padStart(2, "0")}`
      );
    } catch (error) {
      console.error("Failed to add schedule:", error);
      toast.error("Không thể thêm lịch tưới");
      throw error;
    }
  },

  updateSchedule: async (id, schedule) => {
    try {
      const res = await axios.put(`/api/schedules/${id}`, schedule);
      const updated = res.data;
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? updated : s)),
      }));
      get().saveState();
      toast.success("Đã cập nhật lịch tưới");
    } catch (error) {
      console.error("Failed to update schedule:", error);
      toast.error("Không thể cập nhật lịch tưới");
      throw error;
    }
  },

  deleteSchedule: async (id) => {
    try {
      await axios.delete(`/api/schedules/${id}`);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      }));
      get().saveState();
      toast.success("Đã xóa lịch tưới");
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      toast.error("Không thể xóa lịch tưới");
      throw error;
    }
  },

  setSchedules: (schedules) => {
    set({ schedules });
  },

  // Load/Save
  loadState: async () => {
    try {
      const res = await axios.get("/api/state");
      const data = res.data;
      set({
        pumpStatus: data.pumpStatus ?? false,
        threshold: data.threshold ?? 50,
        wateringDuration: data.wateringDuration ?? 60,
        autoMode: data.autoMode ?? true,
        isRaining: data.isRaining ?? false,
        scheduleEnabled: data.scheduleEnabled ?? true,
        delayedWateringEnabled: data.delayedWateringEnabled ?? false,
        delayedWateringHours: data.delayedWateringHours ?? 0,
        delayedWateringMinutes: data.delayedWateringMinutes ?? 10,
        schedules: data.schedules ?? [],
      });
      toast.success("Đã tải trạng thái từ cơ sở dữ liệu");
    } catch (error) {
      console.error("Failed to load state:", error);
      toast.error("Không thể tải trạng thái");
    }
  },

  saveState: async () => {
    try {
      const state = get();
      await axios.post("/api/state", {
        pumpStatus: state.pumpStatus,
        threshold: state.threshold,
        wateringDuration: state.wateringDuration,
        autoMode: state.autoMode,
        isRaining: state.isRaining,
        scheduleEnabled: state.scheduleEnabled,
        delayedWateringEnabled: state.delayedWateringEnabled,
        delayedWateringHours: state.delayedWateringHours,
        delayedWateringMinutes: state.delayedWateringMinutes,
      });
      // Không hiển thị toast cho saveState tự động để tránh spam
    } catch (error) {
      console.error("Failed to save state:", error);
      toast.error("Không thể lưu trạng thái");
    }
  },
}));
