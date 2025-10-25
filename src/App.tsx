import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwawUZ6A748ivdXmW1Oxmv6mi803LQYvvLU8IlCn5SC1vj9_nms-cVEFxl63r-wK7UXFA/exec";

interface Attendance {
  id: number;
  date: string;
  time: string;
  class: string;
  name: string;
  nisn: string;
  photo: string | null;
  status: string;
  mapel: string;
}

interface StudentData {
  nisn: string;
  name: string;
  class: string;
}

interface TeacherData {
  nip: string;
  name: string;
}

interface KepsekData {
  nomorinduk: string;
  name: string;
}

// Example updated interface (around line 38):
interface FormState {
  date: string;
  time: string;
  class: string;
  name: string;
  nisn: string;
  photo: string | null;
  photoBase64: string | null;
  error: string;
  loading: boolean;
  mapel?: string; // 👈 Make optional with ? if it can be missing sometimes
}

interface TeacherAttendanceFormState {
  date: string;
  time: string;
  class: string;
  name: string;
  nisn: string;
  status: string;
  error: string;
  loading: boolean;
}

interface TeacherManagementFormState {
  nip: string;
  name: string;
  error: string;
  loading: boolean;
}

interface StudentFormState {
  nisn: string;
  name: string;
  class: string;
  error: string;
  loading: boolean;
}

interface LoginFormState {
  role: "Guru" | "Siswa" | "Kepala Sekolah" | "";
  name: string;
  idNumber: string;
  error: string;
  loading: boolean;
}

interface MonthlyRecap {
  name: string;
  class: string;
  hadir: number;
  alpa: number;
  izin: number;
  sakit: number;
  persenHadir: string;
}

interface Mapel {
  mapel: string;
}

interface ProcessedAttendance extends Attendance {
  processedPhoto?: string | null;
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<
    "Guru" | "Siswa" | "Kepala Sekolah" | null
  >(null);
  const [currentPage, setCurrentPage] = useState<
    | "form"
    | "data"
    | "students"
    | "teacherForm"
    | "teacherData"
    | "monthlyRecap"
    | "mapelData" // ✅ TAMBAHKAN INI
  >("form");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [teacherData, setTeacherData] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    date: "",
    time: "",
    class: "",
    name: "",
    nisn: "",
    photo: null,
    photoBase64: null,
    error: "",
    loading: false,
    mapel: "", // 👈 Add this
  });
  const [teacherForm, setTeacherForm] = useState<TeacherAttendanceFormState>({
    date: "",
    time: "",
    class: "",
    name: "",
    nisn: "",
    status: "Hadir",
    error: "",
    loading: false,
  });
  const [studentForm, setStudentForm] = useState<StudentFormState>({
    nisn: "",
    name: "",
    class: "",
    error: "",
    loading: false,
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string>("");
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    role: "",
    name: "",
    idNumber: "",
    error: "",
    loading: false,
  });
  const [selectedClassForLogin, setSelectedClassForLogin] =
    useState<string>("");
  const [editStudent, setEditStudent] = useState<StudentData | null>(null);
  const [deleteStudentNisn, setDeleteStudentNisn] = useState<string | null>(
    null
  );
  const [editAttendance, setEditAttendance] = useState<Attendance | null>(null);
  const [showEditAttendanceModal, setShowEditAttendanceModal] = useState(false);
  const [editAttendanceForm, setEditAttendanceForm] = useState({
    status: "",
    date: "",
    time: "",
    photoBase64: null as string | null,
    error: "",
    loading: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [tempAbsensi, setTempAbsensi] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teacherPhotoInputRef = useRef<HTMLInputElement>(null);
  const [teacherPhoto, setTeacherPhoto] = useState<string | null>(null);
  const [teacherPhotoBase64, setTeacherPhotoBase64] = useState<string | null>(
    null
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [isPolling, setIsPolling] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showClearAttendanceModal, setShowClearAttendanceModal] =
    useState(false);

  const [studentAttendanceStatus, setStudentAttendanceStatus] = useState<{
    hasAttended: boolean;
    attendanceDate: string;
    attendedMapel?: string; // 👈 Tambahkan ini (opsional dengan ? agar bisa undefined jika tidak ada)
  }>({ hasAttended: false, attendanceDate: "", attendedMapel: "" });

  const [kepsekData, setKepsekData] = useState<KepsekData[]>([]);
  const [teacherFormState, setTeacherFormState] =
    useState<TeacherManagementFormState>({
      nip: "",
      name: "",
      error: "",
      loading: false,
    });
  const [filterKelas, setFilterKelas] = useState(""); // Default "Semua" seperti gambar
  const [summaryAbsensi, setSummaryAbsensi] = useState({
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpha: 0,
  });
  const [absensiHariIni, setAbsensiHariIni] = useState<{
    [key: string]: string;
  }>({});
  const [editTeacher, setEditTeacher] = useState<TeacherData | null>(null);
  const [deleteTeacherNip, setDeleteTeacherNip] = useState<string | null>(null);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false);

  const [monthlyRecapData, setMonthlyRecapData] = useState<MonthlyRecap[]>([]);
  const [selectedMonthRecap, setSelectedMonthRecap] =
    useState<string>("Januari"); // Default Januari
  const [selectedClassRecap, setSelectedClassRecap] = useState<string>("Semua");
  const [selectedNameRecap, setSelectedNameRecap] = useState<string>("Semua");
  const [loadingRecap, setLoadingRecap] = useState(false);
  // ✅ TAMBAHKAN INI: State untuk manajemen data mapel
  const [mapelData, setMapelData] = useState<Mapel[]>([]);
  const [selectedMapel, setSelectedMapel] = useState("");
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [editMapel, setEditMapel] = useState<Mapel | null>(null); // Untuk mode edit
  const [deleteMapelId, setDeleteMapelId] = useState<string | null>(null); // Untuk konfirmasi hapus
  const [showAddMapelModal, setShowAddMapelModal] = useState(false);
  const [showEditMapelModal, setShowEditMapelModal] = useState(false);
  const [showDeleteMapelModal, setShowDeleteMapelModal] = useState(false);
  const [newMapelForm, setNewMapelForm] = useState({
    mapel: "",
    error: "",
    loading: false,
  });
  const [selectedMapelGuru, setSelectedMapelGuru] = useState("");
  const [isFromPKBM, setIsFromPKBM] = useState(false);
  const [mapelFromParam, setMapelFromParam] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [deleteAttendanceId, setDeleteAttendanceId] = useState<{
    nisn: string;
    date: string;
    mapel: string;
  } | null>(null);
  const [showDeleteAttendanceModal, setShowDeleteAttendanceModal] =
    useState(false);
  const [isManualTime, setIsManualTime] = useState(false);

  // ✅ PINDAHKAN FUNGSI INI KE LUAR useEffect — DI ATAS USEEFFECT, TAPI MASIH DI DALAM COMPONENT App
  const fetchMapelData = async () => {
    setLoadingMapel(true); // Pastikan state loadingMapel sudah ada di atas
    try {
      const response = await fetch(`${ENDPOINT}?action=getMapelData`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMapelData(data.data);
        } else {
          console.error("Gagal ambil data mapel:", data.message);
        }
      }
    } catch (error) {
      console.error("Error fetching mapel data:", error);
    } finally {
      setLoadingMapel(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const makassarTime = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const getPart = (part: string) =>
      makassarTime.find((p) => p.type === part)?.value;
    const date = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const time = `${getPart("hour")}:${getPart("minute")}:${getPart(
      "second"
    )}`.slice(0, 8);

    const lastLogoutTime = localStorage.getItem("lastLogoutTime");
    const initialTime = lastLogoutTime || time;

    setForm(
      (prev: FormState): FormState => ({ ...prev, date, time: initialTime })
    );

    // ✅ UBAH INI: Hanya set initial time jika belum manual
    setTeacherForm(
      (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
        ...prev,
        date,
        time: initialTime,
      })
    );

    // Panggil fetchMapelData
    fetchMapelData();

    // Cek status absensi siswa jika sudah login sebagai siswa
    if (isLoggedIn && userRole === "Siswa" && form.nisn && selectedMapel) {
      checkStudentAttendanceStatus(form.nisn, date, selectedMapel);
    }

    // Fungsi untuk mengambil data
    const fetchData = async () => {
      try {
        const [studentResponse, teacherResponse, kepsekResponse] =
          await Promise.all([
            fetch(`${ENDPOINT}?action=getStudentData`),
            fetch(`${ENDPOINT}?action=getTeacherData`),
            fetch(`${ENDPOINT}?action=getKepsekData`),
          ]);

        if (studentResponse.ok) {
          const studentData = await studentResponse.json();
          setStudentData(studentData.success ? studentData.data : []);
        }

        if (teacherResponse.ok) {
          const teacherData = await teacherResponse.json();
          setTeacherData(teacherData.success ? teacherData.data : []);
        }

        if (kepsekResponse.ok) {
          const kepsekData = await kepsekResponse.json();
          setKepsekData(kepsekData.success ? kepsekData.data : []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    // ✅ UBAH BAGIAN INI - Hanya update time jika TIDAK manual
    const interval = setInterval(() => {
      const now = new Date();
      const makassarTime = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(now);

      const getPart = (part: string) =>
        makassarTime.find((p) => p.type === part)?.value;
      const time = `${getPart("hour")}:${getPart("minute")}:${getPart(
        "second"
      )}`.slice(0, 8);

      // Update form siswa (tetap auto-update)
      setForm((prev: FormState): FormState => ({ ...prev, time }));

      // ✅ KUNCI UTAMA: Hanya update teacherForm.time jika TIDAK diubah manual
      setTeacherForm(
        (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => {
          // Jika isManualTime = true, jangan update time
          if (isManualTime) {
            return prev; // Kembalikan state lama tanpa perubahan
          }
          // Jika isManualTime = false, update time seperti biasa
          return { ...prev, time };
        }
      );
    }, 1000);

    // ... kode lainnya (referrer check, dll)

    return () => {
      clearInterval(interval);
      if (form.photo) {
        URL.revokeObjectURL(form.photo);
      }
    };
  }, [isLoggedIn, userRole, form.nisn, isManualTime]); // ✅ Tambahkan isManualTime ke dependency

  // Auto-polling untuk halaman data absensi
  useEffect(() => {
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    if (currentPage === "data" && userRole === "Guru" && isLoggedIn) {
      setIsPolling(true);
      fetchAttendanceData(false); // false = tidak show loading

      pollingInterval = setInterval(() => {
        fetchAttendanceData(false); // polling tanpa loading indicator
      }, 5000); // setiap 5 detik
    } else {
      setIsPolling(false);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setIsPolling(false);
      }
    };
  }, [currentPage, userRole, isLoggedIn]);

  useEffect(() => {
    if (currentPage === "monthlyRecap" && userRole === "Guru") {
      fetchMonthlyRecap(selectedMonthRecap);
    }
  }, [currentPage, selectedMonthRecap]);

  useEffect(() => {
    if (currentPage === "teacherForm" && userRole === "Guru") {
      fetchAttendanceData(false);
      calculateSummary();
    }
  }, [
    currentPage,
    userRole,
    attendanceData,
    teacherForm.date,
    selectedMapelGuru,
    filterKelas,
  ]); // 👈 TAMBAHKAN dependensi selectedMapelGuru dan filterKelas

  const fetchAttendanceData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `${ENDPOINT}?action=getAttendanceData&_t=${Date.now()}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAttendanceData(data.data);
          setLastRefresh(new Date());
        } else {
          console.error("Error fetching attendance data:", data.error);
        }
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchMonthlyRecap = async (month: string) => {
    setLoadingRecap(true);
    try {
      const response = await fetch(
        `${ENDPOINT}?action=getMonthlyRecap&month=${month}&_t=${Date.now()}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMonthlyRecapData(data.data);
        } else {
          console.error("Error fetching monthly recap:", data.message);
        }
      }
    } catch (error) {
      console.error("Error fetching monthly recap:", error);
    } finally {
      setLoadingRecap(false);
    }
  };

  useEffect(() => {
    setSelectedNameRecap("Semua"); // Reset nama ke "Semua" saat kelas berubah
  }, [selectedClassRecap]);

  const checkStudentAttendanceStatus = async (
    nisn: string,
    date: string,
    mapel: string
  ) => {
    try {
      const response = await fetch(
        `${ENDPOINT}?action=getAttendanceData&_t=${Date.now()}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Cek apakah siswa sudah absen di tanggal & mapel yang sama
          const existingAttendance = data.data.find(
            (attendance: Attendance) => {
              // Konversi format tanggal dari DD/MM/YYYY ke YYYY-MM-DD
              const attendanceDate = attendance.date.includes("/")
                ? attendance.date.split("/").reverse().join("-")
                : attendance.date;

              // ✅ Tambahkan cek mapel!
              return (
                attendance.nisn === nisn &&
                attendanceDate === date &&
                attendance.mapel === mapel // 👈 INI YANG BARU!
              );
            }
          );

          setStudentAttendanceStatus({
            hasAttended: !!existingAttendance,
            attendanceDate: existingAttendance?.date || "",
            attendedMapel: existingAttendance?.mapel || "", // Simpan mapel yang sudah diabsen
          });
        }
      }
    } catch (error) {
      console.error("Error checking student attendance:", error);
    }
  };

  const handleTeacherFormInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setTeacherFormState((prev: TeacherManagementFormState) => ({
      ...prev,
      [name]: value,
      error: "",
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev: FormState): FormState => {
      const updatedForm = { ...prev, [name]: value, error: "" };
      if (name === "name") {
        const selectedStudent = studentData.find((s) => s.name === value);
        if (selectedStudent) {
          updatedForm.nisn = selectedStudent.nisn;
          if (
            updatedForm.class &&
            updatedForm.class !== selectedStudent.class
          ) {
            updatedForm.error = "Kelas tidak sesuai dengan data siswa";
          }
        } else if (updatedForm.class) {
          updatedForm.error = "Nama tidak ditemukan dalam kelas yang dipilih";
        }
      } else if (name === "class") {
        updatedForm.name = "";
        updatedForm.nisn = "";
        const validClass = studentData.some((s) => s.class === value);
        if (!validClass && value) {
          updatedForm.error = "Kelas tidak valid";
        }
      }
      return updatedForm;
    });
  };

  const handleTeacherInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // ✅ UBAH BAGIAN INI - Tambahkan deteksi manual time
    if (name === "date" || name === "time") {
      setTeacherForm(
        (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
          ...prev,
          [name]: value,
          error: "",
        })
      );

      // ✅ TAMBAHKAN INI: Jika guru mengubah jam manual, hentikan auto-update
      if (name === "time") {
        setIsManualTime(true); // Tandai bahwa jam diubah manual
      }

      // Reset data absensi hari ini ketika tanggal berubah
      if (name === "date") {
        setAbsensiHariIni({});
        setTempAbsensi({});
        setIsManualTime(false); // ✅ Reset ke auto-update saat ganti tanggal
      }
      return;
    }

    // 🎯 Handler untuk nama siswa
    if (name === "name") {
      const siswaYangDipilih = studentData.find(
        (siswa) => siswa.name === value && siswa.class === teacherForm.class
      );

      setTeacherForm(
        (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
          ...prev,
          name: value,
          nisn: siswaYangDipilih ? siswaYangDipilih.nisn : "",
          error: "",
        })
      );
    }
    // 🎯 Handler untuk kelas
    else if (name === "class") {
      setTeacherForm(
        (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
          ...prev,
          class: value,
          name: "",
          nisn: "",
          error: "",
        })
      );
    }
    // 🎯 Untuk field lainnya
    else {
      setTeacherForm(
        (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
          ...prev,
          [name]: value,
          error: "",
        })
      );
    }
  };

  const handleStudentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        [name]: value,
        error: "",
      })
    );
  };

  const handleLoginInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setLoginForm((prev) => {
      const updatedForm = { ...prev, [name]: value, error: "" };
      if (name === "role") {
        updatedForm.name = "";
        updatedForm.idNumber = "";
      }
      return updatedForm;
    });
  };

  const handleLogin = async () => {
    if (!loginForm.role || !loginForm.name || !loginForm.idNumber) {
      setLoginForm((prev) => ({
        ...prev,
        error: "Harap lengkapi semua field",
      }));
      return;
    }

    setLoginForm((prev) => ({ ...prev, loading: true, error: "" }));

    let isValid = false;
    if (loginForm.role === "Guru") {
      isValid = teacherData.some(
        (item) =>
          item.name === loginForm.name && item.nip === loginForm.idNumber
      );
    } else if (loginForm.role === "Siswa") {
      isValid = studentData.some(
        (item) =>
          item.name === loginForm.name && item.nisn === loginForm.idNumber
      );
    } else if (loginForm.role === "Kepala Sekolah") {
      // Tambahkan ini
      isValid = kepsekData.some(
        (item) =>
          item.name === loginForm.name && item.nomorinduk === loginForm.idNumber
      );
    }

    if (isValid) {
      setIsLoggedIn(true);
      setUserRole(loginForm.role);
      setCurrentPage(loginForm.role === "Siswa" ? "form" : "teacherForm");

      // If student, pre-fill the form with their details
      if (loginForm.role === "Siswa") {
        setCurrentPage("form");
        const selectedStudent = studentData.find(
          (s) => s.name === loginForm.name && s.nisn === loginForm.idNumber
        );
        if (selectedStudent) {
          const currentDate = new Date().toISOString().split("T")[0];
          setForm((prev) => ({
            ...prev,
            name: selectedStudent.name,
            nisn: selectedStudent.nisn,
            class: selectedStudent.class,
            error: "",
            mapel: selectedMapel, // 👈 Ini penting — simpan mapel ke form
          }));

          // 👇 Tambahkan selectedMapel sebagai parameter ke-3
          checkStudentAttendanceStatus(
            selectedStudent.nisn,
            currentDate,
            selectedMapel
          );
        }
      } else if (loginForm.role === "Guru") {
        setCurrentPage("teacherForm");
        fetchMapelData();
      } else if (loginForm.role === "Kepala Sekolah") {
        // Tambahkan ini
        setCurrentPage("teacherData");
      }

      setLoginForm({
        role: "",
        name: "",
        idNumber: "",
        error: "",
        loading: false,
      });
    } else {
      setLoginForm((prev) => ({
        ...prev,
        error: "Nama atau Nomor Induk tidak valid",
        loading: false,
      }));
    }
  };

  const compressImage = (
    file: File,
    targetSizeMB: number = 0.8
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not supported"));
          return;
        }

        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 1280;

        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.7;
        const minQuality = 0.1;
        const step = 0.1;
        const targetSizeBytes = targetSizeMB * 1024 * 1024;

        const tryCompress = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64 = dataUrl.split(",").slice(-1)[0];
          const byteLength = Math.round((base64.length * 3) / 4);

          if (byteLength <= targetSizeBytes || quality <= minQuality) {
            resolve(base64);
          } else {
            quality -= step;
            setTimeout(tryCompress, 0);
          }
        };

        tryCompress();
      };

      img.onerror = reject;
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: "File harus berupa gambar",
          })
        );
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: "Ukuran file maksimal 10MB",
          })
        );
        return;
      }

      try {
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            loading: true,
            error: "Memproses gambar...",
          })
        );

        const base64 = await compressImage(file, 0.8);
        const compressedSizeKB = Math.round((base64.length * 3) / 4 / 1024);
        console.log(`Ukuran gambar setelah kompresi: ${compressedSizeKB} KB`);

        const photoURL = URL.createObjectURL(file);

        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            photo: photoURL,
            photoBase64: base64,
            error: "",
            loading: false,
          })
        );

        event.target.value = "";
      } catch (error) {
        console.error("Error processing file:", error);
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error:
              "Gagal memproses file. Coba gunakan gambar yang lebih kecil.",
            loading: false,
          })
        );
      }
    }
  };

  const openCameraApp = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const retakePhoto = () => {
    if (form.photo) {
      URL.revokeObjectURL(form.photo);
    }

    setForm(
      (prev: FormState): FormState => ({
        ...prev,
        photo: null,
        photoBase64: null,
        error: "",
      })
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTeacherFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setTeacherForm(
          (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
            ...prev,
            error: "File harus berupa gambar",
          })
        );
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setTeacherForm(
          (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
            ...prev,
            error: "Ukuran file maksimal 10MB",
          })
        );
        return;
      }

      try {
        setTeacherForm(
          (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
            ...prev,
            loading: true,
            error: "Memproses gambar...",
          })
        );

        const base64 = await compressImage(file, 0.8);
        const photoURL = URL.createObjectURL(file);

        setTeacherPhoto(photoURL);
        setTeacherPhotoBase64(base64);
        setTeacherForm(
          (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
            ...prev,
            error: "",
            loading: false,
          })
        );

        event.target.value = "";
      } catch (error) {
        console.error("Error processing file:", error);
        setTeacherForm(
          (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
            ...prev,
            error:
              "Gagal memproses file. Coba gunakan gambar yang lebih kecil.",
            loading: false,
          })
        );
      }
    }
  };

  const openTeacherCamera = () => {
    if (teacherPhotoInputRef.current) {
      teacherPhotoInputRef.current.click();
    }
  };

  const retakeTeacherPhoto = () => {
    if (teacherPhoto) {
      URL.revokeObjectURL(teacherPhoto);
    }
    setTeacherPhoto(null);
    setTeacherPhotoBase64(null);
    setTeacherForm(
      (prev: TeacherAttendanceFormState): TeacherAttendanceFormState => ({
        ...prev,
        error: "",
      })
    );

    if (teacherPhotoInputRef.current) {
      teacherPhotoInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.class || !form.name || !form.nisn) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Harap lengkapi semua field yang diperlukan",
        })
      );
      return;
    }

    const selectedStudent = studentData.find(
      (s) => s.name === form.name && s.nisn === form.nisn
    );
    if (selectedStudent && form.class !== selectedStudent.class) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Kelas tidak sesuai dengan data siswa",
        })
      );
      return;
    }

    if (!form.photoBase64) {
      setForm(
        (prev: FormState): FormState => ({
          ...prev,
          error: "Harap unggah foto terlebih dahulu",
        })
      );
      return;
    }

    setForm(
      (prev: FormState): FormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photoBase64,
          status: "Hadir",
          mapel: form.mapel, // <-- Tambahkan ini
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        const newAttendance: Attendance = {
          id: attendances.length + 1,
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photo,
          status: "Hadir",
          mapel: form.mapel || "", // 👈 Tambahkan ini (gunakan form.mapel jika ada, atau string kosong sebagai default)
        };
        setAttendances((prev) => [...prev, newAttendance]);
        setAttendanceData((prev) => [...prev, newAttendance]);

        if (form.photo) {
          URL.revokeObjectURL(form.photo);
        }
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            class: "",
            name: "",
            nisn: "",
            photo: null,
            photoBase64: null,
            error: "",
            loading: false,
          })
        );

        console.log("Absensi berhasil disimpan!");
        alert("Absensi berhasil disimpan!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error detail:", error);

      try {
        console.log("Mencoba metode alternatif...");
        const params = new URLSearchParams({
          action: "addAttendance",
          date: form.date,
          time: form.time,
          class: form.class,
          name: form.name,
          nisn: form.nisn,
          photo: form.photoBase64.substring(0, 1000) + "...",
          status: "Hadir",
        });

        const alternativeResponse = await fetch(`${ENDPOINT}?${params}`, {
          method: "GET",
          mode: "no-cors",
        });

        console.log("Alternative response:", alternativeResponse);
        alert("Data berhasil dikirim dengan metode alternatif!");

        if (form.photo) {
          URL.revokeObjectURL(form.photo);
        }
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            class: "",
            name: "",
            nisn: "",
            photo: null,
            photoBase64: null,
            error: "",
            loading: false,
            mapel: "", // 👈 Add this (or use prev.mapel to preserve it)
          })
        );
      } catch (altError) {
        console.error("Alternative method error:", altError);
        setForm(
          (prev: FormState): FormState => ({
            ...prev,
            error: `Gagal menyimpan data. Pastikan:\n1. Koneksi internet stabil\n2. Google Apps Script dapat diakses\n3. Ukuran foto tidak terlalu besar\n\nError: ${error.message}`,
            loading: false,
          })
        );
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentPage("form");
    setIsPolling(false); // Tambahkan ini

    // Dapatkan tanggal dan jam saat ini
    const makassarTime = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const getPart = (part: string) =>
      makassarTime.find((p) => p.type === part)?.value;
    const currentDate = `${getPart("year")}-${getPart("month")}-${getPart(
      "day"
    )}`;
    const currentTime = `${getPart("hour")}:${getPart("minute")}`.slice(0, 5);

    // Reset form dengan tanggal dan jam realtime
    setForm({
      date: currentDate, // Set ke tanggal saat ini
      time: currentTime, // Set ke jam saat ini
      class: "",
      name: "",
      nisn: "",
      photo: null,
      photoBase64: null,
      error: "",
      loading: false,
    });

    setTeacherForm({
      date: currentDate, // Set ke tanggal saat ini
      time: currentTime, // Set ke jam saat ini
      class: "",
      name: "",
      nisn: "",
      status: "Hadir",
      error: "",
      loading: false,
    });

    // Reset foto guru
    if (teacherPhoto) {
      URL.revokeObjectURL(teacherPhoto);
    }
    setTeacherPhoto(null);
    setTeacherPhotoBase64(null);

    alert("Anda telah logout.");
  };

  // Ganti handleSubmitStatus menjadi handleSelectStatus
  const handleSelectStatus = (student: StudentData, status: string) => {
    const { nisn } = student;

    // Validasi jika sudah absen hari ini (dari data yang sudah tersimpan)
    if (absensiHariIni[nisn]) {
      alert("Siswa ini sudah absen hari ini.");
      return;
    }

    // Simpan status sementara
    setTempAbsensi((prev) => ({ ...prev, [nisn]: status }));
  };

  // Fungsi untuk kirim semua data (modif untuk batch dengan 1 foto)
  const handleKirimSemuaAbsen = async () => {
    const siswaYangBelumAbsen = Object.keys(tempAbsensi);

    if (siswaYangBelumAbsen.length === 0) {
      alert("Tidak ada data absensi yang dipilih.");
      return;
    }

    setTeacherForm((prev) => ({ ...prev, loading: true, error: "" }));

    // Prepare array attendances
    const attendances: Attendance[] = [];

    siswaYangBelumAbsen.forEach((nisn) => {
      const student = studentData.find((s) => s.nisn === nisn);
      const status = tempAbsensi[nisn];

      if (student && status) {
        attendances.push({
          id: attendances.length + 1,
          date: teacherForm.date,
          time: teacherForm.time,
          class: student.class,
          name: student.name,
          nisn: student.nisn,
          status: status,
          photo: null,
          mapel: selectedMapelGuru || "", // 👈 TAMBAHKAN INI: Sertakan mapel yang dipilih, fallback kosong jika tidak pilih
        });
      }
    });

    if (attendances.length === 0) {
      setTeacherForm((prev) => ({
        ...prev,
        loading: false,
        error: "Tidak ada data valid untuk dikirim.",
      }));
      return;
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendances: attendances, // Array absensi per siswa
          photo: teacherPhotoBase64, // Base64 foto kelas (opsional, backend handle upload sekali)
        }),
      });

      if (response.type === "opaque") {
        // Update local data (asumsi sukses, karena no-cors)
        const newAttendances: Attendance[] = attendances.map((data, index) => ({
          id: attendanceData.length + index + 1,
          date: data.date,
          time: data.time,
          class: data.class,
          name: data.name,
          nisn: data.nisn,
          status: data.status,
          photo: teacherPhoto || null,
          mapel: data.mapel, // 👈 Tambahkan ini (ambil dari data.mapel, karena sudah ada di attendances)
        }));
        setAttendanceData((prev) => [...prev, ...newAttendances]);

        // Update status lokal dan reset
        setAbsensiHariIni((prev) => ({ ...prev, ...tempAbsensi }));
        setTempAbsensi({});
        retakeTeacherPhoto();
        calculateSummary();

        alert(`Berhasil mengirim ${attendances.length} data absensi!`);
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error) {
      console.error(error);
      setTeacherForm((prev) => ({
        ...prev,
        error: "Gagal menyimpan data absensi.",
      }));
    } finally {
      setTeacherForm((prev) => ({ ...prev, loading: false }));
    }
  };

  // Fungsi untuk hitung summary berdasarkan absensi hari ini
  const calculateSummary = () => {
    // ✅ PERBAIKAN: Jika kelas atau mapel belum dipilih, jangan hitung apa-apa. Biarkan summary tetap 0.
    if (!filterKelas || !selectedMapelGuru) {
      setSummaryAbsensi({
        hadir: 0,
        izin: 0,
        sakit: 0,
        alpha: 0,
      });
      setAbsensiHariIni({}); // Kosongkan juga status per siswa
      return;
    }

    const selectedDate = teacherForm.date;
    const absensiToday = attendanceData.filter((att) => {
      const attDate = att.date.includes("/")
        ? att.date.split("/").reverse().join("-")
        : att.date;
      let matchMapel = true;
      let matchKelas = true;

      // Filter mapel jika dipilih
      if (selectedMapelGuru) {
        matchMapel = att.mapel === selectedMapelGuru;
      }

      // Filter kelas jika dipilih
      if (filterKelas) {
        matchKelas = att.class === filterKelas;
      }

      return attDate === selectedDate && matchMapel && matchKelas;
    });

    const summary = {
      hadir: absensiToday.filter((att) => att.status === "Hadir").length,
      izin: absensiToday.filter((att) => att.status === "Izin").length,
      sakit: absensiToday.filter((att) => att.status === "Sakit").length,
      alpha: absensiToday.filter((att) => att.status === "Alpha").length,
    };

    setSummaryAbsensi(summary);

    // Update status per siswa
    const statusMap: { [key: string]: string } = {};
    absensiToday.forEach((att) => {
      statusMap[att.nisn] = att.status;
    });
    setAbsensiHariIni(statusMap);
  };

  // Fungsi untuk filter siswa berdasarkan kelas
  const getFilteredStudents = () => {
    if (filterKelas === "Semua") {
      return studentData;
    }
    return studentData.filter((student) => student.class === filterKelas);
  };

  const handleAddStudent = async () => {
    if (!studentForm.nisn || !studentForm.name || !studentForm.class) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "Harap lengkapi semua field",
        })
      );
      return;
    }

    if (studentData.some((s) => s.nisn === studentForm.nisn)) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "NISN sudah ada",
        })
      );
      return;
    }

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addStudent",
          nisn: studentForm.nisn,
          name: studentForm.name,
          class: studentForm.class,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) => [
          ...prev,
          {
            nisn: studentForm.nisn,
            name: studentForm.name,
            class: studentForm.class,
          },
        ]);
        setStudentForm({
          nisn: "",
          name: "",
          class: "",
          error: "",
          loading: false,
        });
        setShowAddModal(false);
        alert("Data siswa berhasil ditambahkan!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error adding student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal menambahkan siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handleEditStudent = async () => {
    if (
      !editStudent ||
      !studentForm.nisn ||
      !studentForm.name ||
      !studentForm.class
    ) {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: "Harap lengkapi semua field",
        })
      );
      return;
    }

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "editStudent",
          originalNisn: editStudent.nisn,
          nisn: studentForm.nisn,
          name: studentForm.name,
          class: studentForm.class,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) =>
          prev.map((s) =>
            s.nisn === editStudent.nisn
              ? {
                  nisn: studentForm.nisn,
                  name: studentForm.name,
                  class: studentForm.class,
                }
              : s
          )
        );
        setStudentForm({
          nisn: "",
          name: "",
          class: "",
          error: "",
          loading: false,
        });
        setShowEditModal(false);
        setEditStudent(null);
        alert("Data siswa berhasil diperbarui!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error editing student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal memperbarui siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteStudentNisn) return;

    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteStudent",
          nisn: deleteStudentNisn,
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData((prev) =>
          prev.filter((s) => s.nisn !== deleteStudentNisn)
        );
        setShowDeleteModal(false);
        setDeleteStudentNisn(null);
        alert("Data siswa berhasil dihapus!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error deleting student:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal menghapus siswa: ${error.message}`,
          loading: false,
        })
      );
    }
  };

  const handleDeleteAllStudents = async () => {
    setStudentForm(
      (prev: StudentFormState): StudentFormState => ({
        ...prev,
        loading: true,
        error: "",
      })
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteAllStudents",
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setStudentData([]); // Kosongkan data siswa lokal
        setShowDeleteAllModal(false);
        alert("Semua data siswa berhasil dihapus!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error deleting all students:", error);
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          error: `Gagal menghapus semua data siswa: ${error.message}`,
          loading: false,
        })
      );
    } finally {
      setStudentForm(
        (prev: StudentFormState): StudentFormState => ({
          ...prev,
          loading: false,
        })
      );
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      setImportError("Pilih file Excel terlebih dahulu.");
      return;
    }

    setImportLoading(true);
    setImportError("");

    try {
      // Baca file Excel
      const arrayBuffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      // Validasi header (baris pertama harus NISN, Nama, Kelas)
      const header = jsonData[0].map((h: string) => h.trim().toLowerCase());
      if (
        header[0] !== "nisn" ||
        header[1] !== "nama" ||
        header[2] !== "kelas"
      ) {
        setImportError("Header Excel harus: NISN, Nama, Kelas.");
        setImportLoading(false);
        return;
      }

      // Parse data (mulai dari baris kedua)
      const students: StudentData[] = jsonData
        .slice(1)
        .map((row: any[]) => ({
          nisn: row[0]?.toString() || "",
          name: row[1]?.toString() || "",
          class: row[2]?.toString() || "",
        }))
        .filter((student) => student.nisn && student.name && student.class); // Filter data tidak lengkap

      if (students.length === 0) {
        setImportError("Tidak ada data valid di Excel.");
        setImportLoading(false);
        return;
      }

      // Cek duplikat lokal (opsional: untuk feedback cepat)
      const duplicates = students.filter((s) =>
        studentData.some((existing) => existing.nisn === s.nisn)
      );
      if (duplicates.length > 0) {
        setImportError(
          `Duplikat NISN ditemukan: ${duplicates
            .map((s) => s.nisn)
            .join(", ")}. Data ini akan diabaikan di backend.`
        );
      }

      // Kirim ke backend
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "importStudents",
          students: students,
        }),
      });

      if (response.type === "opaque") {
        // Update state lokal (tambah data baru yang belum ada)
        setStudentData((prev) => {
          const newData = [...prev];
          students.forEach((student) => {
            if (!newData.some((s) => s.nisn === student.nisn)) {
              newData.push(student);
            }
          });
          return newData;
        });
        alert(`Berhasil import ${students.length} data siswa!`);
        setImportFile(null); // Reset file
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error importing Excel:", error);
      setImportError(`Gagal import: ${error.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const headers = ["NISN", "Nama", "Kelas"]; // Header template sederhana
      const data = [headers]; // Hanya header, tanpa data tambahan (kosong)

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }]; // Lebar kolom opsional untuk tampilan bagus

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");

      // Buat blob dari workbook (sama seperti kode-mu)
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Nama file dinamis (opsional, seperti kode-mu)
      const date = new Date()
        .toLocaleString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(/ /g, "_")
        .replace(/:/g, "-");
      const fileName = `Template_Siswa_${date}.xlsx`;

      // Cek apakah browser mendukung download langsung (handling IE/Edge & Mobile, seperti kode-mu)
      if (window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
        // IE & Edge
        (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
      } else {
        // Browser modern & Mobile
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();

        // Cleanup dengan timeout (seperti kode-mu, lebih aman di HP)
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
      }

      // Tampilkan notifikasi sukses (seperti kode-mu)
      alert("✅ Template Excel berhasil diunduh!");
    } catch (error) {
      console.error("Error saat download Template Excel:", error);
      alert("❌ Gagal mengunduh template Excel. Silakan coba lagi.");
    }
  };

  const handleAddTeacher = async () => {
    if (!teacherFormState.nip || !teacherFormState.name) {
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: "Harap lengkapi semua field",
      }));
      return;
    }

    if (teacherData.some((t) => t.nip === teacherFormState.nip)) {
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: "NIP sudah ada",
      }));
      return;
    }

    setTeacherFormState((prev: TeacherManagementFormState) => ({
      ...prev,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addTeacher",
          nip: teacherFormState.nip,
          name: teacherFormState.name,
        }),
      });

      if (response.type === "opaque") {
        setTeacherData((prev) => [
          ...prev,
          {
            nip: teacherFormState.nip,
            name: teacherFormState.name,
          },
        ]);
        setTeacherFormState({
          nip: "",
          name: "",
          error: "",
          loading: false,
        });
        setShowAddTeacherModal(false);
        alert("Data guru berhasil ditambahkan!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error adding teacher:", error);
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: `Gagal menambahkan guru: ${error.message}`,
        loading: false,
      }));
    }
  };

  const handleEditTeacher = async () => {
    if (!editTeacher || !teacherFormState.nip || !teacherFormState.name) {
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: "Harap lengkapi semua field",
      }));
      return;
    }

    setTeacherFormState((prev: TeacherManagementFormState) => ({
      ...prev,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "editTeacher",
          originalNip: editTeacher.nip,
          nip: teacherFormState.nip,
          name: teacherFormState.name,
        }),
      });

      if (response.type === "opaque") {
        setTeacherData((prev) =>
          prev.map((t) =>
            t.nip === editTeacher.nip
              ? {
                  nip: teacherFormState.nip,
                  name: teacherFormState.name,
                }
              : t
          )
        );
        setTeacherFormState({
          nip: "",
          name: "",
          error: "",
          loading: false,
        });
        setShowEditTeacherModal(false);
        setEditTeacher(null);
        alert("Data guru berhasil diperbarui!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error editing teacher:", error);
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: `Gagal memperbarui guru: ${error.message}`,
        loading: false,
      }));
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteTeacherNip) return;

    setTeacherFormState((prev: TeacherManagementFormState) => ({
      ...prev,
      loading: true,
      error: "",
    }));

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteTeacher",
          nip: deleteTeacherNip,
        }),
      });

      if (response.type === "opaque") {
        setTeacherData((prev) =>
          prev.filter((t) => t.nip !== deleteTeacherNip)
        );
        setShowDeleteTeacherModal(false);
        setDeleteTeacherNip(null);
        alert("Data guru berhasil dihapus!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error deleting teacher:", error);
      setTeacherFormState((prev: TeacherManagementFormState) => ({
        ...prev,
        error: `Gagal menghapus guru: ${error.message}`,
        loading: false,
      }));
    }
  };

  const handlePageChange = (
    page:
      | "form"
      | "data"
      | "students"
      | "teacherForm"
      | "teacherData"
      | "monthlyRecap"
      | "mapelData" // 👈 TAMBAHKAN INI!
  ) => {
    setCurrentPage(page);
    if (page === "data") {
      fetchAttendanceData(true); // show loading saat pertama kali
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Opsional: Tutup menu setelah pilih item
  const handleMenuItemClick = (
    page:
      | "form"
      | "data"
      | "students"
      | "teacherForm"
      | "teacherData"
      | "monthlyRecap"
      | "mapelData" // ✅ TAMBAHKAN INI
  ) => {
    handlePageChange(page);
    setIsMenuOpen(false);
  };

  const handleClearAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "clearStudentAttendance",
        }),
      });

      console.log("Response type:", response.type);

      if (response.type === "opaque") {
        setAttendanceData([]); // Kosongkan data absensi lokal
        alert(
          "Semua data absensi siswa di halaman ini dan sheet 'AbsenSiswa' telah dihapus."
        );
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error clearing student attendance:", error);
      alert(`Gagal menghapus data absensi siswa: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDFRecap = async (): Promise<void> => {
    const button = document.getElementById(
      "downloadPdfRecapButton"
    ) as HTMLButtonElement;
    if (!button) return;

    const originalButtonText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Memproses...
    `;

    try {
      const jsPDF = (window as any).jsPDF || (window as any).jspdf.jsPDF;
      const doc = new jsPDF();

      // Filter data sesuai filter aktif
      const filteredData = monthlyRecapData.filter((recap) => {
        const classMatch =
          selectedClassRecap === "Semua" || recap.class === selectedClassRecap;
        const nameMatch =
          selectedNameRecap === "Semua" || recap.name === selectedNameRecap;
        return classMatch && nameMatch;
      });

      // Header PDF
      doc.setFontSize(16);
      doc.text(`Rekap Absensi Bulanan - ${selectedMonthRecap}`, 14, 15);

      let yPosition = 25;
      doc.setFontSize(12);
      if (selectedClassRecap !== "Semua") {
        doc.text(`Kelas: ${selectedClassRecap}`, 14, yPosition);
        yPosition += 10;
      }
      if (selectedNameRecap !== "Semua") {
        doc.text(`Nama: ${selectedNameRecap}`, 14, yPosition);
        yPosition += 10;
      }
      doc.setFontSize(10);
      doc.text(
        `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`,
        14,
        yPosition
      );
      yPosition += 10;

      // Tabel data
      const tableData = filteredData.map((recap) => [
        recap.name,
        recap.class,
        recap.hadir,
        recap.alpa,
        recap.izin,
        recap.sakit,
        `${recap.persenHadir}%`,
      ]);

      doc.autoTable({
        head: [["Nama", "Kelas", "Hadir", "Alpa", "Izin", "Sakit", "% Hadir"]],
        body: tableData,
        startY: yPosition + 5,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 40 }, // Nama
          1: { cellWidth: 20 }, // Kelas
          2: { cellWidth: 20 }, // Hadir
          3: { cellWidth: 20 }, // Alpa
          4: { cellWidth: 20 }, // Izin
          5: { cellWidth: 20 }, // Sakit
          6: { cellWidth: 25 }, // % Hadir
        },
      });

      // Ringkasan statistik
      const totalHadir = filteredData.reduce((sum, r) => sum + r.hadir, 0);
      const totalAlpa = filteredData.reduce((sum, r) => sum + r.alpa, 0);
      const totalIzin = filteredData.reduce((sum, r) => sum + r.izin, 0);
      const totalSakit = filteredData.reduce((sum, r) => sum + r.sakit, 0);
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("Ringkasan:", 14, finalY);
      doc.setFontSize(10);
      doc.text(`Total Hadir: ${totalHadir}`, 14, finalY + 10);
      doc.text(`Total Alpa: ${totalAlpa}`, 14, finalY + 20);
      doc.text(`Total Izin: ${totalIzin}`, 60, finalY + 20);
      doc.text(`Total Sakit: ${totalSakit}`, 100, finalY + 20);

      // Simpan PDF
      doc.save(`Rekap_Bulanan_${selectedMonthRecap}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Terjadi kesalahan saat membuat PDF. Silakan coba lagi.");
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonText;
    }
  };

  const getStatusByDateAndNISN = (nisn: string, date: string) => {
    // Format tanggal: DD/MM/YYYY
    const formattedDate = date.split("-").reverse().join("/"); // YYYY-MM-DD → DD/MM/YYYY
    const record = attendanceData.find((att) => {
      return (
        att.nisn === nisn &&
        att.date === formattedDate &&
        att.mapel === selectedMapelGuru // 👈 TAMBAHKAN INI: Filter berdasarkan mapel yang dipilih
      );
    });
    return record ? record.status : null;
  };

  const renderLoginPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Login</h2>
      <div className="space-y-4">
        <select
          name="role"
          value={loginForm.role}
          onChange={handleLoginInputChange}
          disabled={isFromPKBM} // ✅ TAMBAH INI: Disable jika dari PKBM (role auto Siswa, tidak bisa ganti)
          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" // ✅ Tambah disabled:opacity-50 untuk visual
        >
          <option value="">Pilih Peran</option>
          <option value="Guru">Guru</option>
          <option value="Siswa">Siswa</option>
          <option value="Kepala Sekolah">Kepala Sekolah</option>
        </select>

        {loginForm.role === "Siswa" && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1"></label>
            <input
              type="text"
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              placeholder="Ketik nama mata pelajaran (misal: Matematika)"
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" // ✅ Tambah disabled:opacity-50 untuk visual
              disabled={isFromPKBM || !loginForm.role} // ✅ TAMBAH INI: Disable jika dari PKBM (atau role belum pilih)
            />
          </div>
        )}

        {/* ✅ POSISI BARU: Dropdown Kelas di bawah Mata Pelajaran (hanya jika role Siswa) */}
        {loginForm.role === "Siswa" && (
          <select
            value={selectedClassForLogin}
            onChange={(e) => {
              setSelectedClassForLogin(e.target.value);
              // Reset nama saat kelas berubah
              setLoginForm((prev) => ({ ...prev, name: "", error: "" }));
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!loginForm.role}
          >
            <option value="">Pilih Kelas</option>
            {[...new Set(studentData.map((s) => s.class))].map((kelas) => (
              <option key={kelas} value={kelas}>
                {kelas}
              </option>
            ))}
          </select>
        )}

        {/* ✅ MODIFIKASI: Dropdown Nama - Hanya tampilkan siswa sesuai kelas yang dipilih */}
        <select
          name="name"
          value={loginForm.name}
          onChange={handleLoginInputChange}
          disabled={
            !loginForm.role ||
            (loginForm.role === "Siswa" && !selectedClassForLogin)
          }
          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Pilih Nama</option>
          {loginForm.role === "Guru"
            ? teacherData.map((item) => (
                <option key={item.nip} value={item.name}>
                  {item.name}
                </option>
              ))
            : loginForm.role === "Siswa"
            ? studentData
                .filter(
                  (student) =>
                    selectedClassForLogin === "" ||
                    student.class === selectedClassForLogin
                )
                .map((item) => (
                  <option key={item.nisn} value={item.name}>
                    {item.name}
                  </option>
                ))
            : loginForm.role === "Kepala Sekolah"
            ? kepsekData.map((item) => (
                <option key={item.nomorinduk} value={item.name}>
                  {item.name}
                </option>
              ))
            : null}
        </select>

        <input
          type="text"
          name="idNumber"
          value={loginForm.idNumber}
          onChange={handleLoginInputChange}
          placeholder={
            loginForm.role === "Guru"
              ? "NIP"
              : loginForm.role === "Siswa"
              ? "NISN"
              : loginForm.role === "Kepala Sekolah"
              ? "Nomor Induk"
              : "Nomor Induk"
          }
          disabled={
            !loginForm.role ||
            (loginForm.role === "Siswa" && !selectedClassForLogin)
          }
          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {loginForm.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
            {loginForm.error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={
            loginForm.loading ||
            !loginForm.role ||
            (loginForm.role === "Siswa" && !selectedClassForLogin)
          }
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
        >
          {loginForm.loading ? "⏳ Memproses..." : "Login"}
        </button>

        {/* ✅ TAMBAHKAN KONDISI: Tombol Kembali hanya muncul jika dari link PKBM */}
        {isFromPKBM && (
          <div className="mt-4">
            <button
              onClick={() => window.history.back()}
              className="block w-full text-center bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg transition duration-200"
            >
              ← Kembali
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderFormPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="date"
              value={form.date}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
            <input
              type="text"
              name="time"
              value={form.time}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
            />
          </div>

          <input
            type="text"
            name="mapel"
            value={form.mapel || "Belum dipilih"}
            readOnly
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
          />

          <input
            type="text"
            name="class"
            value={form.class}
            readOnly
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
          />

          <input
            type="text"
            name="name"
            value={form.name}
            readOnly
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
          />

          <input
            type="text"
            name="nisn"
            value={form.nisn}
            readOnly
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
          />

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {!form.photo && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openCameraApp}
                  disabled={form.loading}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center disabled:opacity-50"
                >
                  {form.loading ? "⏳ Memproses..." : "📸 Buka Kamera HP"}
                </button>
                <div className="text-xs text-gray-500 text-center">
                  Akan membuka aplikasi kamera HP Anda
                </div>
              </div>
            )}

            {form.photo && (
              <div className="space-y-2">
                <img
                  src={form.photo}
                  alt="Preview foto"
                  className="w-full h-64 object-cover rounded-lg border-2 border-green-300"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex-1 bg-yellow-600 text-white p-2 rounded-lg hover:bg-yellow-700 transition duration-200"
                  >
                    📸 Ambil Ulang
                  </button>
                  <button
                    type="button"
                    onClick={openCameraApp}
                    className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200"
                  >
                    📷 Foto Lain
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {form.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg whitespace-pre-line">
            {form.error}
          </div>
        )}

        {studentAttendanceStatus.hasAttended ? (
          <div className="w-full bg-green-100 border border-green-400 text-green-700 p-4 rounded-lg text-center">
            <p className="font-semibold">✅ Anda sudah mengabsen hari ini</p>
            <p className="text-sm">
              Tanggal absen: {studentAttendanceStatus.attendanceDate}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!form.photoBase64 || form.loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {form.loading ? "⏳ Menyimpan..." : "✅ Tambah Absen"}
          </button>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs uppercase bg-gray-200">
            <tr>
              <th className="px-4 py-2">Tanggal</th>
              <th className="px-4 py-2">Jam</th>
              <th className="px-4 py-2">Kelas</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">NISN</th>
              <th className="px-4 py-2">Foto</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Mapel</th> {/* 👈 BARU! */}
            </tr>
          </thead>
          <tbody>
            {attendances.map((attendance) => (
              <tr key={attendance.id} className="border-b">
                <td className="px-4 py-2">{attendance.date}</td>
                <td className="px-4 py-2">{attendance.time}</td>
                <td className="px-4 py-2">{attendance.class}</td>
                <td className="px-4 py-2">{attendance.name}</td>
                <td className="px-4 py-2">{attendance.nisn}</td>
                <td className="px-4 py-2">
                  {attendance.photo ? (
                    <img
                      src={attendance.photo}
                      alt="Foto siswa"
                      className="w-12 h-12 object-cover rounded-full border-2 border-gray-300"
                    />
                  ) : (
                    <span className="text-gray-500">Tidak ada foto</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Ganti seluruh fungsi renderTeacherFormPage menjadi ini
  const renderTeacherFormPage = () => {
    const filteredStudents = getFilteredStudents();
    const totalSiswa = filteredStudents.length;

    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        {/* Hapus tombol Buka Menu, tapi tetap field tanggal dengan mb-4 untuk spacing */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Tanggal dengan Ikon Kalender */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal:
            </label>
            <div className="relative">
              <input
                type="date"
                name="date"
                value={teacherForm.date}
                onChange={handleTeacherInputChange}
                className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
                📅
              </span>
            </div>
          </div>

          {/* Custom Time Picker 24 Jam dengan Mini Tabel (Grid Select) & Ikon Refresh */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jam (HH:MM:SS) - Format 24 Jam:
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                name="time"
                value={teacherForm.time}
                onChange={handleTeacherInputChange}
                placeholder="08:30:00"
                pattern="([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]"
                maxLength={8}
                className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  // Reset ke jam realtime Makassar (logika existing dari useEffect)
                  const now = new Date();
                  const makassarTime = new Intl.DateTimeFormat("id-ID", {
                    timeZone: "Asia/Makassar",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  }).formatToParts(now);

                  const getPart = (part: string) =>
                    makassarTime.find((p) => p.type === part)?.value;
                  const time = `${getPart("hour")}:${getPart(
                    "minute"
                  )}:${getPart("second")}`.slice(0, 8);

                  setTeacherForm((prev) => ({ ...prev, time }));
                  setIsManualTime(false); // Aktifkan auto-update lagi jika di-reset
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                title="Reset ke Jam Sekarang"
              >
                🔄
              </button>
            </div>

            {/* Mini Tabel/Grid untuk Pilih Jam, Menit, Detik (Format 24 Jam) */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-2">
                Pilih Jam Cepat (Klik untuk Set):
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {/* Kolom Jam (00-23) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Jam</p>
                  <select
                    value={teacherForm.time.split(":")[0] || "00"}
                    onChange={(e) => {
                      const [_, min, sec] = teacherForm.time.split(":");
                      const newTime = `${e.target.value.padStart(2, "0")}:${
                        min || "00"
                      }:${sec || "00"}`;
                      setTeacherForm((prev) => ({ ...prev, time: newTime }));
                      setIsManualTime(true);
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kolom Menit (00-59) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Menit</p>
                  <select
                    value={teacherForm.time.split(":")[1] || "00"}
                    onChange={(e) => {
                      const [hour, _, sec] = teacherForm.time.split(":");
                      const newTime = `${
                        hour || "00"
                      }:${e.target.value.padStart(2, "0")}:${sec || "00"}`;
                      setTeacherForm((prev) => ({ ...prev, time: newTime }));
                      setIsManualTime(true);
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kolom Detik (00-59) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Detik</p>
                  <select
                    value={teacherForm.time.split(":")[2] || "00"}
                    onChange={(e) => {
                      const [hour, min, _] = teacherForm.time.split(":");
                      const newTime = `${hour || "00"}:${
                        min || "00"
                      }:${e.target.value.padStart(2, "0")}`;
                      setTeacherForm((prev) => ({ ...prev, time: newTime }));
                      setIsManualTime(true);
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, "0")}>
                        {i.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Opsi Jam Cepat Preset (Opsional, seperti contoh jam pelajaran) */}
              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                {[
                  "07:00:00",
                  "08:30:00",
                  "10:00:00",
                  "11:30:00",
                  "13:00:00",
                  "14:30:00",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTeacherForm((prev) => ({ ...prev, time: preset }));
                      setIsManualTime(true);
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition duration-200"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Filter Kelas
          </label>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="">Pilih Kelas</option>{" "}
            {/* 👈 UBAH: Ganti "Semua" jadi kosong/prompt */}
            {/* Daftar kelas unik dari studentData */}
            {[...new Set(studentData.map((s) => s.class))].map((kelas) => (
              <option key={kelas} value={kelas}>
                {kelas}
              </option>
            ))}
          </select>
        </div>
        {/* 👈 TAMBAHKAN INI: Dropdown Filter Mapel */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Filter Mata Pelajaran
          </label>
          <select
            value={selectedMapelGuru}
            onChange={(e) => {
              setSelectedMapelGuru(e.target.value);
              setTempAbsensi({}); // 👈 TAMBAHKAN INI: Reset pilihan sementara saat mapel berubah
            }}
            className="w-full p-2 border border-gray-300 rounded-lg"
            disabled={mapelData.length === 0}
          >
            <option value="">Pilih Mata Pelajaran</option>
            {mapelData.map((mapel, index) => (
              <option key={index} value={mapel.mapel}>
                {mapel.mapel}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4 text-center">
          <span>
            Menampilkan: {filterKelas || "Semua Kelas"} - Mapel:{" "}
            {selectedMapelGuru || "Semua Mapel"} - Tanggal:{" "}
            {teacherForm.date.replace(/-/g, "/")} - Total Siswa: {totalSiswa}
          </span>
        </div>
        {/* Summary Kotak seperti gambar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <h3 className="text-3xl font-bold">{summaryAbsensi.hadir}</h3>
            <p>Hadir</p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg text-center">
            <h3 className="text-3xl font-bold">{summaryAbsensi.izin}</h3>
            <p>Izin</p>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg text-center">
            <h3 className="text-3xl font-bold">{summaryAbsensi.sakit}</h3>
            <p>Sakit</p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg text-center">
            <h3 className="text-3xl font-bold">{summaryAbsensi.alpha}</h3>
            <p>Alpha</p>
          </div>
        </div>
        {/* Daftar Siswa */}
        <div className="overflow-x-auto">
          {selectedMapelGuru === "" || filterKelas === "" ? (
            // 👈 TAMPILKAN SATU PESAN INI JIKA BELUM PILIH MAPEL ATAU KELAS
            <div className="p-6 text-center text-gray-500 italic bg-gray-50 border border-gray-200 rounded-lg">
              Silahkan pilih kelas dan Mata Pelajaran terlebih dahulu untuk
              memunculkan daftar nama siswa
            </div>
          ) : filteredStudents.length > 0 ? (
            // 👈 TAMPILKAN DAFTAR SISWA HANYA JIKA KEDUA KONDISI TERPENUHI
            filteredStudents.map((student) => {
              const isAlreadyAttended = !!absensiHariIni[student.nisn];
              const tempStatus = tempAbsensi[student.nisn];
              return (
                <div
                  key={student.nisn}
                  className="flex justify-between items-center border-b py-2" // Tetap flex justify-between
                >
                  <div className="flex-1 pr-4 min-w-0">
                    {" "}
                    {/* ✅ EDIT: Tambah flex-1 pr-4 min-w-0 untuk ratakan kiri dan cegah overflow */}
                    <p className="text-xs font-semibold ">{student.name}</p>{" "}
                    {/* ✅ EDIT: Tambah truncate agar nama panjang dipotong dengan ... */}
                    <p className="text-sm">Kelas {student.class}</p>{" "}
                    {/* ✅ EDIT BARU: Pisah kelas ke baris sendiri */}
                    <p className="text-sm">NISN: {student.nisn}</p>
                    {tempStatus && (
                      <p className="text-xs text-blue-600 truncate">
                        Status dipilih: {tempStatus}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
                    {" "}
                    {/* ✅ EDIT: space-x-1 untuk mobile, sm:space-x-2 untuk desktop; flex-shrink-0 agar tidak menyusut */}
                    <button
                      onClick={() => handleSelectStatus(student, "Hadir")}
                      disabled={!!absensiHariIni[student.nisn]}
                      className={`px-2 py-1 rounded-lg text-xs sm:text-sm sm:px-3 ${
                        /* ✅ EDIT: px-2 py-1 text-xs untuk mobile, sm:px-3 sm:text-sm untuk desktop */
                        tempStatus === "Hadir"
                          ? "bg-green-600 text-white"
                          : getStatusByDateAndNISN(
                              student.nisn,
                              teacherForm.date
                            ) === "Hadir"
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } transition duration-200 whitespace-nowrap`} /* ✅ EDIT: Tambah whitespace-nowrap agar tombol tidak wrap */
                    >
                      Hadir
                    </button>
                    <button
                      onClick={() => handleSelectStatus(student, "Izin")}
                      disabled={!!absensiHariIni[student.nisn]}
                      className={`px-2 py-1 rounded-lg text-xs sm:text-sm sm:px-3 ${
                        tempStatus === "Izin"
                          ? "bg-yellow-600 text-white"
                          : getStatusByDateAndNISN(
                              student.nisn,
                              teacherForm.date
                            ) === "Izin"
                          ? "bg-yellow-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } transition duration-200 whitespace-nowrap`}
                    >
                      Izin
                    </button>
                    <button
                      onClick={() => handleSelectStatus(student, "Sakit")}
                      disabled={!!absensiHariIni[student.nisn]}
                      className={`px-2 py-1 rounded-lg text-xs sm:text-sm sm:px-3 ${
                        tempStatus === "Sakit"
                          ? "bg-purple-600 text-white"
                          : getStatusByDateAndNISN(
                              student.nisn,
                              teacherForm.date
                            ) === "Sakit"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } transition duration-200 whitespace-nowrap`}
                    >
                      Sakit
                    </button>
                    <button
                      onClick={() => handleSelectStatus(student, "Alpha")}
                      disabled={!!absensiHariIni[student.nisn]}
                      className={`px-2 py-1 rounded-lg text-xs sm:text-sm sm:px-3 ${
                        tempStatus === "Alpha"
                          ? "bg-red-600 text-white"
                          : getStatusByDateAndNISN(
                              student.nisn,
                              teacherForm.date
                            ) === "Alpha"
                          ? "bg-red-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } transition duration-200 whitespace-nowrap`}
                    >
                      Alpha
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            // 👈 TAMPILKAN PESAN INI JIKA KELAS DAN MAPEL SUDAH DIPILIH, TAPI TIDAK ADA SISWA
            <div className="p-6 text-center text-gray-500 italic">
              Tidak ada siswa di kelas ini.
            </div>
          )}
        </div>
        {/* Tambahkan input foto dan tombol Kirim Absen di bagian bawah */}
        {Object.keys(tempAbsensi).length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">
              Siap mengirim {Object.keys(tempAbsensi).length} data absensi:
            </h3>
            <ul className="text-sm mb-4">
              {Object.entries(tempAbsensi).map(([nisn, status]) => {
                const student = studentData.find((s) => s.nisn === nisn);
                return (
                  <li key={nisn}>
                    {student?.name} - {status}
                  </li>
                );
              })}
            </ul>

            {/* Bagian Foto Guru */}
            <div className="mb-4 p-3 bg-white rounded-lg border">
              <h4 className="font-medium mb-2 text-gray-700">
                Foto Kelas (Opsional)
              </h4>

              <input
                ref={teacherPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleTeacherFileSelect}
                style={{ display: "none" }}
              />

              {!teacherPhoto && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openTeacherCamera}
                    disabled={teacherForm.loading}
                    className="w-full bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center justify-center disabled:opacity-50"
                  >
                    {teacherForm.loading
                      ? "⏳ Memproses..."
                      : "📸 Ambil Foto Kelas"}
                  </button>
                  <div className="text-xs text-gray-500 text-center">
                    Foto dokumentasi kegiatan absensi (opsional)
                  </div>
                </div>
              )}

              {teacherPhoto && (
                <div className="space-y-2">
                  <img
                    src={teacherPhoto}
                    alt="Preview foto kelas"
                    className="w-full h-48 object-cover rounded-lg border-2 border-green-300"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={retakeTeacherPhoto}
                      className="flex-1 bg-yellow-600 text-white p-2 rounded-lg hover:bg-yellow-700 transition duration-200"
                    >
                      📸 Ambil Ulang
                    </button>
                    <button
                      type="button"
                      onClick={openTeacherCamera}
                      className="flex-1 bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 transition duration-200"
                    >
                      📷 Foto Lain
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleKirimSemuaAbsen}
                disabled={teacherForm.loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {teacherForm.loading ? "⏳ Mengirim..." : "Kirim Semua Absen"}
              </button>
              <button
                onClick={() => {
                  setTempAbsensi({});
                  retakeTeacherPhoto(); // Reset foto juga
                }}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
              >
                Reset Pilihan
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleEditAttendanceInputChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { value } = e.target;
    setEditAttendanceForm((prev) => ({
      ...prev,
      status: value,
      error: "",
    }));
  };

  const handleEditAttendance = async () => {
    if (!editAttendance || !editAttendanceForm.status) {
      setEditAttendanceForm({
        ...editAttendanceForm,
        error: "Status harus dipilih",
      });
      return;
    }

    setEditAttendanceForm({
      ...editAttendanceForm,
      loading: true,
      error: "",
    });

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "editAttendance",
          date: editAttendance.date,
          nisn: editAttendance.nisn,
          mapel: editAttendance.mapel,
          newStatus: editAttendanceForm.status,
        }),
      });

      if (response.type === "opaque") {
        // Update local state
        setAttendanceData((prev) =>
          prev.map((att) =>
            att.nisn === editAttendance!.nisn &&
            att.date === editAttendance!.date &&
            att.mapel === editAttendance!.mapel
              ? { ...att, status: editAttendanceForm.status }
              : att
          )
        );
        setShowEditAttendanceModal(false);
        setEditAttendance(null);
        setEditAttendanceForm({
          status: "",
          date: "",
          time: "",
          photoBase64: null,
          error: "",
          loading: false,
        });
        alert("Status kehadiran berhasil diperbarui!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error editing attendance:", error);
      setEditAttendanceForm({
        ...editAttendanceForm,
        error: `Gagal memperbarui status: ${error.message}`,
        loading: false,
      });
    }
  };

  const handleDeleteAttendance = async () => {
    if (!deleteAttendanceId) return;

    setLoading(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteAttendance",
          nisn: deleteAttendanceId.nisn,
          date: deleteAttendanceId.date,
          mapel: deleteAttendanceId.mapel,
        }),
      });

      if (response.type === "opaque") {
        // Update local state - hapus data dari attendanceData
        setAttendanceData((prev) =>
          prev.filter(
            (att) =>
              !(
                att.nisn === deleteAttendanceId.nisn &&
                att.date === deleteAttendanceId.date &&
                att.mapel === deleteAttendanceId.mapel
              )
          )
        );
        setShowDeleteAttendanceModal(false);
        setDeleteAttendanceId(null);
        alert("Data absensi berhasil dihapus!");
      } else {
        throw new Error("Unexpected response type");
      }
    } catch (error: any) {
      console.error("Error deleting attendance:", error);
      alert(`Gagal menghapus data absensi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderDataPage = () => {
    // Fungsi untuk mengkonversi Google Drive link ke direct download link
    const convertGoogleDriveUrl = (url: string): string => {
      if (url.includes("drive.google.com/file/d/")) {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const fileId = match[1];
          return `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0`;
        }
      }
      return url; // Return original URL if not a Google Drive link
    };

    // Alternative converter for Google Drive
    const convertGoogleDriveUrlAlt = (url: string): string => {
      if (url.includes("drive.google.com/file/d/")) {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const fileId = match[1];
          return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
      }
      return url;
    };

    // ✅ TAMBAHKAN INI: Ambil kelas unik dari attendanceData untuk dropdown
    const uniqueClasses = [
      "", // Opsi "Semua" (kosong)
      ...new Set(attendanceData.map((att) => att.class).filter(Boolean)),
    ];

    // Fungsi untuk download PDF
    const downloadPDF = async (): Promise<void> => {
      const button = document.getElementById(
        "downloadPdfButton"
      ) as HTMLButtonElement;
      if (!button) return;

      // Simpan teks dan status awal
      const originalButtonText = button.innerHTML;

      // Ubah teks saat memproses
      button.disabled = true;
      button.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Memproses gambar...
    `;

      try {
        // Debug: Check what's available in window
        console.log("window.jsPDF:", (window as any).jsPDF);
        console.log("window.jspdf:", (window as any).jspdf);
        console.log(
          "Available properties:",
          Object.keys(window).filter((key) => key.toLowerCase().includes("pdf"))
        );

        // Alternative ways to access jsPDF
        let jsPDF: any;

        if ((window as any).jsPDF) {
          jsPDF = (window as any).jsPDF;
          console.log("Using window.jsPDF");
        } else if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
          jsPDF = (window as any).jspdf.jsPDF;
          console.log("Using window.jspdf.jsPDF");
        } else {
          // Try to load script dynamically
          console.log("Attempting to load jsPDF dynamically...");
          const script = document.createElement("script");
          script.src = "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js";
          script.onload = () => {
            console.log("jsPDF loaded dynamically");
            setTimeout(() => downloadPDF(), 100); // Retry after script loads
          };
          script.onerror = () => {
            alert("Gagal memuat library jsPDF. Periksa koneksi internet Anda.");
          };
          document.head.appendChild(script);
          return;
        }

        const doc = new jsPDF();

        // Filter data berdasarkan bulan, tanggal, mapel, dan kelas ✅ TAMBAHKAN matchClass
        const filteredData: Attendance[] = attendanceData.filter(
          (attendance: Attendance) => {
            let matchMonth = true;
            let matchDate = true;
            let matchMapel = true;
            let matchClass = true; // ✅ TAMBAHKAN INI

            // Filter berdasarkan bulan
            if (selectedMonth) {
              const [day, month, year] = attendance.date.split("/");
              matchMonth = month === selectedMonth;
            }

            // Filter berdasarkan tanggal
            if (selectedDate) {
              const [day, month, year] = attendance.date.split("/");
              const attendanceDate = `${year}-${month.padStart(
                2,
                "0"
              )}-${day.padStart(2, "0")}`;
              matchDate = attendanceDate === selectedDate;
            }

            // Filter berdasarkan mata pelajaran
            if (selectedMapel) {
              matchMapel = attendance.mapel === selectedMapel;
            }

            // ✅ TAMBAHKAN INI: Filter berdasarkan kelas
            if (selectedClass) {
              matchClass = attendance.class === selectedClass;
            }

            return matchMonth && matchDate && matchMapel && matchClass; // ✅ TAMBAHKAN matchClass
          }
        );

        // PDF Header
        doc.setFontSize(16);
        doc.text("Laporan Data Absensi Siswa", 14, 15);

        let yPosition = 25;

        // Month filter information
        if (selectedMonth) {
          const monthNames = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember",
          ];
          const monthName = monthNames[parseInt(selectedMonth) - 1];
          doc.setFontSize(12);
          doc.text(`Bulan: ${monthName}`, 14, yPosition);
          yPosition += 10;
        }

        // Date filter information
        if (selectedDate) {
          const [year, month, day] = selectedDate.split("-");
          doc.setFontSize(12);
          doc.text(`Tanggal: ${day}/${month}/${year}`, 14, yPosition);
          yPosition += 10;
        }

        // ✅ TAMBAHKAN INI: Class filter information
        if (selectedClass) {
          doc.setFontSize(12);
          doc.text(`Kelas: ${selectedClass}`, 14, yPosition);
          yPosition += 10;
        }

        // Print date
        doc.setFontSize(10);
        doc.text(
          `Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`,
          14,
          yPosition
        );
        yPosition += 10;

        // Helper function to load image from URL with multiple attempts
        const loadImageFromUrl = (url: string): Promise<string> => {
          return new Promise(async (resolve, reject) => {
            console.log("Original URL:", url);

            // Try multiple URL formats for Google Drive
            const urlsToTry: string[] = [];

            if (url.includes("drive.google.com/file/d/")) {
              const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
              if (match && match[1]) {
                const fileId = match[1];
                urlsToTry.push(
                  `https://lh3.googleusercontent.com/d/${fileId}=w1000?authuser=0`,
                  `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
                  `https://drive.google.com/uc?export=view&id=${fileId}`,
                  `https://drive.google.com/uc?id=${fileId}`,
                  url // original URL as last resort
                );
              }
            } else {
              urlsToTry.push(url);
            }

            console.log("URLs to try:", urlsToTry);

            // Try each URL until one works
            for (let i = 0; i < urlsToTry.length; i++) {
              const tryUrl = urlsToTry[i];
              console.log(`Trying URL ${i + 1}/${urlsToTry.length}:`, tryUrl);

              try {
                const result = await new Promise<string>((resolve, reject) => {
                  const img = new Image();
                  img.crossOrigin = "anonymous";

                  const timeout = setTimeout(() => {
                    reject(new Error("Image load timeout"));
                  }, 10000); // 10 second timeout

                  img.onload = () => {
                    clearTimeout(timeout);
                    try {
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      if (!ctx) {
                        reject(new Error("Cannot get canvas context"));
                        return;
                      }

                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx.drawImage(img, 0, 0);
                      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                      resolve(dataUrl);
                    } catch (error) {
                      reject(error);
                    }
                  };

                  img.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Failed to load image: ${error}`));
                  };

                  img.src = tryUrl;
                });

                console.log("Successfully loaded image from:", tryUrl);
                resolve(result);
                return; // Success, exit the loop
              } catch (error) {
                console.log(`Failed to load from ${tryUrl}:`, error);
                // Continue to next URL
              }
            }

            // If all URLs failed
            console.log("All URLs failed for:", url);
            reject(new Error("Failed to load image from all attempted URLs"));
          });
        };

        // Preprocess images - convert all images to base64 with timeout
        console.log("Starting image preprocessing...");
        const processImageWithTimeout = async (
          attendance: Attendance,
          timeout: number = 15000
        ): Promise<ProcessedAttendance> => {
          if (!attendance.photo) {
            return { ...attendance, processedPhoto: null };
          }

          return Promise.race([
            (async (): Promise<ProcessedAttendance> => {
              try {
                console.log(
                  `Processing image for ${attendance.name}:`,
                  attendance.photo
                );
                let processedPhoto: string | null = attendance.photo;

                if (
                  attendance.photo &&
                  attendance.photo.startsWith("https://")
                ) {
                  processedPhoto = await loadImageFromUrl(attendance.photo);
                  console.log(
                    "Successfully processed image for:",
                    attendance.name
                  );
                } else if (
                  attendance.photo &&
                  !attendance.photo.startsWith("data:image")
                ) {
                  processedPhoto = await loadImageFromUrl(attendance.photo);
                }

                return { ...attendance, processedPhoto };
              } catch (error) {
                console.log(
                  "Failed to process image for:",
                  attendance.name,
                  error
                );
                return { ...attendance, processedPhoto: null };
              }
            })(),
            new Promise<ProcessedAttendance>((_, reject) =>
              setTimeout(
                () => reject(new Error("Image processing timeout")),
                timeout
              )
            ),
          ]).catch((error): ProcessedAttendance => {
            console.log(
              "Image processing timed out or failed for:",
              attendance.name,
              error
            );
            return { ...attendance, processedPhoto: null };
          });
        };

        // Process images with limited concurrency
        const processedData: ProcessedAttendance[] = [];
        const batchSize = 3; // Process 3 images at a time

        for (let i = 0; i < filteredData.length; i += batchSize) {
          const batch = filteredData.slice(i, i + batchSize);
          console.log(
            `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
              filteredData.length / batchSize
            )}`
          );

          const batchResults = await Promise.all(
            batch.map((attendance: Attendance) =>
              processImageWithTimeout(attendance)
            )
          );

          processedData.push(...batchResults);

          // Small delay between batches
          if (i + batchSize < filteredData.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        console.log(
          "Image preprocessing completed. Results:",
          processedData.map((d) => ({
            name: d.name,
            hasPhoto: !!d.photo,
            processedSuccessfully: !!d.processedPhoto,
          }))
        );

        // Prepare table data with processed photos
        const tableData: (string | number)[][] = processedData.map(
          (attendance: ProcessedAttendance) => {
            let photoStatus = "Tidak ada foto";
            if (attendance.processedPhoto) {
              photoStatus = "Ada foto";
            }
            return [
              attendance.date,
              attendance.time,
              attendance.class,
              attendance.name,
              attendance.nisn,
              photoStatus,
              attendance.status,
              attendance.mapel || "Belum dipilih", // 👈 TAMBAHKAN INI
            ];
          }
        );

        // Create table using autoTable with custom didDrawCell for photos
        doc.autoTable({
          head: [
            [
              "Tanggal",
              "Jam",
              "Kelas",
              "Nama",
              "NISN",
              "Foto",
              "Status",
              "Mapel",
            ],
          ],
          body: tableData,
          startY: yPosition + 5,
          styles: {
            fontSize: 9,
            cellPadding: 3,
            minCellHeight: 20,
          },
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 22 }, // Tanggal
            1: { cellWidth: 18 }, // Jam
            2: { cellWidth: 18 }, // Kelas
            3: { cellWidth: 35 }, // Nama
            4: { cellWidth: 25 }, // NISN
            5: { cellWidth: 30 }, // Foto
            6: { cellWidth: 20 }, // Status
            7: { cellWidth: 25 }, // 👈 Mapel
          },
          didDrawCell: (data: any) => {
            // Add photo if available - HANYA untuk baris data, BUKAN header
            if (
              data.column.index === 5 &&
              data.row.index >= 0 &&
              data.section === "body"
            ) {
              // Photo column - hanya untuk body, bukan header
              const attendance = processedData[data.row.index];

              if (attendance && attendance.processedPhoto) {
                try {
                  // Clear the cell text first (remove "Ada foto" text)
                  doc.setFillColor(255, 255, 255); // White background
                  if (data.row.index % 2 !== 0) {
                    doc.setFillColor(248, 250, 252); // Alternate row color
                  }
                  doc.rect(
                    data.cell.x,
                    data.cell.y,
                    data.cell.width,
                    data.cell.height,
                    "F"
                  );

                  // Add only the image, no text
                  const imgWidth = 15;
                  const imgHeight = 15;
                  const x = data.cell.x + (data.cell.width - imgWidth) / 2; // Center horizontally
                  const y = data.cell.y + (data.cell.height - imgHeight) / 2; // Center vertically

                  doc.addImage(
                    attendance.processedPhoto,
                    "JPEG",
                    x,
                    y,
                    imgWidth,
                    imgHeight
                  );
                } catch (error) {
                  console.log("Error adding image to PDF:", error);
                  doc.setFontSize(8);
                  doc.text("Error foto", data.cell.x + 2, data.cell.y + 10);
                }
              } else {
                // Only show text when there's no photo
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text("Tidak ada", data.cell.x + 2, data.cell.y + 10);
                doc.setTextColor(0, 0, 0); // Reset color
              }
            }
            // TIDAK menambahkan gambar untuk header (data.section === 'head')
          },
        });

        // Statistics below table
        const totalData = filteredData.length;
        const hadirCount = filteredData.filter(
          (a) => a.status === "Hadir"
        ).length;
        const alphaCount = filteredData.filter(
          (a) => a.status === "Alpha"
        ).length;
        const izinCount = filteredData.filter(
          (a) => a.status === "Izin"
        ).length;
        const sakitCount = filteredData.filter(
          (a) => a.status === "Sakit"
        ).length;

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text("Ringkasan:", 14, finalY);
        doc.setFontSize(10);
        doc.text(`Total Data: ${totalData}`, 14, finalY + 10);
        doc.text(`Hadir: ${hadirCount}`, 14, finalY + 20);
        doc.text(`Alpha: ${alphaCount}`, 60, finalY + 20);
        doc.text(`Izin: ${izinCount}`, 100, finalY + 20);
        doc.text(`Sakit: ${sakitCount}`, 140, finalY + 20);

        // Generate filename
        const monthNames = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ];

        let fileName = `Absensi_${new Date().getFullYear()}.pdf`;

        if (selectedDate) {
          const [year, month, day] = selectedDate.split("-");
          fileName = `Absensi_${day}-${month}-${year}.pdf`;
        } else if (selectedMonth) {
          const monthName = monthNames[parseInt(selectedMonth) - 1];
          fileName = `Absensi_${monthName}_${new Date().getFullYear()}.pdf`;
        }

        // Download PDF
        doc.save(fileName);
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Terjadi kesalahan saat membuat PDF. Silakan coba lagi.");
      } finally {
        // Kembalikan teks dan status tombol ke kondisi awal
        button.disabled = false;
        button.innerHTML = originalButtonText;
      }
    };

    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Data Absensi
              </h2>
              <div className="flex items-center gap-4 mt-2">
                {lastRefresh && (
                  <p className="text-xs text-gray-500">
                    Terakhir diperbarui:{" "}
                    {lastRefresh.toLocaleTimeString("id-ID")}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isPolling ? "bg-green-400" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-xs text-gray-600">
                    {isPolling ? "Auto-update aktif" : "Auto-update nonaktif"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fetchAttendanceData(true)}
                disabled={loading}
                className="hidden px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Memuat..." : "Refresh"}
              </button>

              {/* Tombol-tombol lainnya tetap sama */}
              <button
                onClick={() => setShowClearAttendanceModal(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Hapus Semua Data Absensi Siswa
              </button>

              <button
                id="downloadPdfButton"
                onClick={downloadPDF}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-lg flex items-center gap-2 transition-colors duration-200" // ✅ EDIT BARU: px-3 py-1 text-sm untuk perkecil tombol
                disabled={loading || attendanceData.length === 0}
              >
                <svg
                  className="w-3 h-3" // ✅ EDIT BARU: w-3 h-3 untuk perkecil ikon SVG
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download PDF
              </button>
            </div>
          </div>

          {/* Filter Section ✅ UBAH GRID JADI 4 KOLOM, TAMBAHKAN FILTER KELAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {" "}
            {/* ✅ Ubah md:grid-cols-3 jadi 4 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter per Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Bulan</option>
                {[
                  "Januari",
                  "Februari",
                  "Maret",
                  "April",
                  "Mei",
                  "Juni",
                  "Juli",
                  "Agustus",
                  "September",
                  "Oktober",
                  "November",
                  "Desember",
                ].map((month, index) => {
                  const monthValue = String(index + 1).padStart(2, "0");
                  return (
                    <option key={monthValue} value={monthValue}>
                      {month}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter per Tanggal
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter Mata Pelajaran
              </label>
              <select
                value={selectedMapel} // ← Menggunakan state yang sama
                onChange={(e) => setSelectedMapel(e.target.value)} // ← ✅ INI YANG HILANG DAN HARUS DITAMBAHKAN!
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mapelData.length === 0}
              >
                <option value="">Semua Mata Pelajaran</option>
                {mapelData.map((mapel, index) => (
                  <option key={index} value={mapel.mapel}>
                    {mapel.mapel}
                  </option>
                ))}
              </select>
            </div>
            {/* ✅ TAMBAHKAN INI — DROPDOWN FILTER KELAS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter Kelas
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Kelas</option>
                {uniqueClasses.map((cls, index) => (
                  <option key={index} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(selectedMonth ||
            selectedDate ||
            selectedMapel ||
            selectedClass) && ( // ✅ TAMBAHKAN selectedClass ke kondisi
            <div className="mt-3">
              <button
                onClick={() => {
                  setSelectedMonth("");
                  setSelectedDate("");
                  setSelectedMapel(""); // ✅ TAMBAHKAN ini untuk reset mapel
                  setSelectedClass(""); // ✅ TAMBAHKAN INI untuk reset kelas
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Hapus Semua Filter
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Memuat data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs uppercase bg-gray-200">
                <tr>
                  <th className="px-4 py-2">Tanggal</th>
                  <th className="px-4 py-2">Jam</th>
                  <th className="px-4 py-2">Kelas</th>
                  <th className="px-4 py-2">Nama</th>
                  <th className="px-4 py-2">NISN</th>
                  <th className="px-4 py-2">Foto</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Mapel</th>
                  <th className="px-4 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9} // ✅ Tetap 8 (karena kolom: Tanggal, Jam, Kelas, Nama, NISN, Foto, Status, Mapel)
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada data absensi
                    </td>
                  </tr>
                ) : (
                  attendanceData
                    .filter((attendance: Attendance) => {
                      let matchMonth = true;
                      let matchDate = true;
                      let matchMapel = true; // 👈 TAMBAHKAN INI: Variabel untuk filter mapel
                      let matchClass = true; // ✅ TAMBAHKAN INI: Variabel untuk filter kelas

                      if (selectedMonth) {
                        const [day, month, year] = attendance.date.split("/");
                        matchMonth = month === selectedMonth;
                      }

                      if (selectedDate) {
                        const [day, month, year] = attendance.date.split("/");
                        const attendanceDate = `${year}-${month.padStart(
                          2,
                          "0"
                        )}-${day.padStart(2, "0")}`;
                        matchDate = attendanceDate === selectedDate;
                      }

                      // 👈 TAMBAHKAN INI: Filter berdasarkan mapel
                      if (selectedMapel) {
                        matchMapel = attendance.mapel === selectedMapel; // Bandingkan dengan attendance.mapel
                      }

                      // ✅ TAMBAHKAN INI: Filter berdasarkan kelas
                      if (selectedClass) {
                        matchClass = attendance.class === selectedClass;
                      }

                      return (
                        matchMonth && matchDate && matchMapel && matchClass
                      ); // ✅ TAMBAHKAN matchClass ke kondisi return
                    })
                    .map((attendance: Attendance, index: number) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{attendance.date}</td>
                        <td className="px-4 py-2">{attendance.time}</td>
                        <td className="px-4 py-2">{attendance.class}</td>
                        <td className="px-4 py-2">{attendance.name}</td>
                        <td className="px-4 py-2">{attendance.nisn}</td>
                        <td className="px-4 py-2">
                          {attendance.photo ? (
                            attendance.photo.startsWith("https://") ? (
                              attendance.photo.includes("drive.google.com") ? (
                                <div className="flex flex-col items-center">
                                  <img
                                    src={convertGoogleDriveUrl(
                                      attendance.photo
                                    )}
                                    alt="Foto siswa"
                                    className="w-12 h-12 object-cover rounded-full border-2 border-gray-300 mb-1"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      if (attendance.photo) {
                                        target.src = convertGoogleDriveUrlAlt(
                                          attendance.photo
                                        );
                                        target.onerror = () => {
                                          target.style.display = "none";
                                          const parent = target.parentElement;
                                          if (parent) {
                                            const span =
                                              document.createElement("span");
                                            span.className =
                                              "text-xs text-gray-500";
                                            span.textContent = "Preview gagal";
                                            parent.appendChild(span);
                                          }
                                        };
                                      }
                                    }}
                                  />
                                  <a
                                    href={attendance.photo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-xs"
                                  >
                                    Buka Foto
                                  </a>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <img
                                    src={attendance.photo}
                                    alt="Foto siswa"
                                    className="w-12 h-12 object-cover rounded-full border-2 border-gray-300 mb-1"
                                  />
                                  <a
                                    href={attendance.photo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-xs"
                                  >
                                    Link
                                  </a>
                                </div>
                              )
                            ) : (
                              <img
                                src={attendance.photo}
                                alt="Foto siswa"
                                className="w-12 h-12 object-cover rounded-full border-2 border-gray-300"
                              />
                            )
                          ) : (
                            <span className="text-gray-500">
                              Tidak ada foto
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              attendance.status === "Hadir"
                                ? "bg-green-100 text-green-800"
                                : attendance.status === "Alpha"
                                ? "bg-red-100 text-red-800"
                                : attendance.status === "Izin"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {attendance.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {attendance.mapel || "Belum dipilih"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditAttendance(attendance);

                                // ✅ Konversi tanggal dari DD/MM/YYYY ke YYYY-MM-DD untuk input date
                                let convertedDate = "";
                                if (attendance.date.includes("/")) {
                                  const [day, month, year] =
                                    attendance.date.split("/");
                                  const fullYear =
                                    year.length === 2 ? `20${year}` : year;
                                  convertedDate = `${fullYear}-${month.padStart(
                                    2,
                                    "0"
                                  )}-${day.padStart(2, "0")}`;
                                } else {
                                  convertedDate = attendance.date;
                                }

                                setEditAttendanceForm({
                                  status: attendance.status,
                                  date: convertedDate, // ✅ Set tanggal
                                  time: attendance.time, // ✅ Set jam
                                  photoBase64: null,
                                  error: "",
                                  loading: false,
                                });
                                setShowEditAttendanceModal(true);
                              }}
                              className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition duration-200 text-xs"
                            >
                              Edit Status
                            </button>
                            <button
                              onClick={() => {
                                setDeleteAttendanceId({
                                  nisn: attendance.nisn,
                                  date: attendance.date,
                                  mapel: attendance.mapel || "",
                                });
                                setShowDeleteAttendanceModal(true);
                              }}
                              className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition duration-200 text-xs"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Semua Absensi */}
        {showClearAttendanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                Konfirmasi Hapus Semua Data Absensi
              </h2>
              <p className="mb-4">
                Apakah Anda yakin ingin menghapus semua data absensi siswa?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={async () => {
                    await handleClearAttendance(); // Jalankan penghapusan jika klik Ya
                    setShowClearAttendanceModal(false); // Tutup modal setelah selesai
                  }}
                  disabled={loading} // Gunakan state loading existing untuk disable tombol saat proses
                  className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
                >
                  {loading ? "⏳ Menghapus..." : "Ya, Hapus"}
                </button>
                <button
                  onClick={() => setShowClearAttendanceModal(false)} // Tutup modal jika klik Tidak
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Tidak
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 👇 Modal Edit Status Kehadiran - UPDATE LENGKAP */}
        {showEditAttendanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                Edit Data Kehadiran
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>Nama:</strong> {editAttendance?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>NISN:</strong> {editAttendance?.nisn}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Mapel:</strong>{" "}
                    {editAttendance?.mapel || "Belum dipilih"}
                  </p>
                </div>

                {/* ✅ TAMBAH: Input Tanggal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={editAttendanceForm.date}
                    onChange={(e) =>
                      setEditAttendanceForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                        error: "",
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* ✅ TAMBAH: Input Jam */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jam (HH:MM:SS) - Format 24 Jam:
                  </label>
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={editAttendanceForm.time}
                      onChange={(e) =>
                        setEditAttendanceForm((prev) => ({
                          ...prev,
                          time: e.target.value,
                          error: "",
                        }))
                      }
                      placeholder="08:30:00"
                      pattern="([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]"
                      maxLength={8}
                      className="w-full p-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // Reset ke jam realtime Makassar
                        const now = new Date();
                        const makassarTime = new Intl.DateTimeFormat("id-ID", {
                          timeZone: "Asia/Makassar",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        }).formatToParts(now);

                        const getPart = (part: string) =>
                          makassarTime.find((p) => p.type === part)?.value;
                        const time = `${getPart("hour")}:${getPart(
                          "minute"
                        )}:${getPart("second")}`.slice(0, 8);

                        setEditAttendanceForm((prev) => ({ ...prev, time }));
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      title="Reset ke Jam Sekarang"
                    >
                      🔄
                    </button>
                  </div>

                  {/* Mini Tabel/Grid untuk Pilih Jam, Menit, Detik (seperti gambar) */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Pilih Jam Cepat (Klik untuk Set):
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {/* Kolom Jam (00-23) */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Jam</p>
                        <select
                          value={editAttendanceForm.time.split(":")[0] || "00"}
                          onChange={(e) => {
                            const [_, min, sec] =
                              editAttendanceForm.time.split(":");
                            const newTime = `${e.target.value.padStart(
                              2,
                              "0"
                            )}:${min || "00"}:${sec || "00"}`;
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              time: newTime,
                            }));
                          }}
                          className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option
                              key={i}
                              value={i.toString().padStart(2, "0")}
                            >
                              {i.toString().padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Kolom Menit (00-59) */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Menit</p>
                        <select
                          value={editAttendanceForm.time.split(":")[1] || "00"}
                          onChange={(e) => {
                            const [hour, _, sec] =
                              editAttendanceForm.time.split(":");
                            const newTime = `${
                              hour || "00"
                            }:${e.target.value.padStart(2, "0")}:${
                              sec || "00"
                            }`;
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              time: newTime,
                            }));
                          }}
                          className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option
                              key={i}
                              value={i.toString().padStart(2, "0")}
                            >
                              {i.toString().padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Kolom Detik (00-59) */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Detik</p>
                        <select
                          value={editAttendanceForm.time.split(":")[2] || "00"}
                          onChange={(e) => {
                            const [hour, min, _] =
                              editAttendanceForm.time.split(":");
                            const newTime = `${hour || "00"}:${
                              min || "00"
                            }:${e.target.value.padStart(2, "0")}`;
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              time: newTime,
                            }));
                          }}
                          className="w-full p-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option
                              key={i}
                              value={i.toString().padStart(2, "0")}
                            >
                              {i.toString().padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Opsi Jam Cepat Preset (seperti gambar) */}
                    <div className="mt-3 flex flex-wrap gap-1 justify-center">
                      {[
                        "07:00:00",
                        "08:30:00",
                        "10:00:00",
                        "11:30:00",
                        "13:00:00",
                        "14:30:00",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              time: preset,
                            }));
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition duration-200"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status Kehadiran */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Kehadiran
                  </label>
                  <select
                    value={editAttendanceForm.status}
                    onChange={(e) =>
                      setEditAttendanceForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                        error: "",
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pilih Status</option>
                    <option value="Hadir">Hadir</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Alpha">Alpha</option>
                  </select>
                </div>

                {/* Foto (hanya jika Hadir) */}
                {editAttendanceForm.status === "Hadir" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Foto Absensi (Opsional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const base64 = await compressImage(file, 0.8);
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              photoBase64: base64,
                            }));
                          } catch (err) {
                            setEditAttendanceForm((prev) => ({
                              ...prev,
                              error: "Gagal memproses gambar",
                            }));
                          }
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                    {editAttendanceForm.photoBase64 && (
                      <p className="text-xs text-green-600">
                        Foto siap dikirim
                      </p>
                    )}
                  </div>
                )}

                {editAttendanceForm.error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                    {editAttendanceForm.error}
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={async () => {
                      // ✅ VALIDASI
                      if (!editAttendanceForm.status) {
                        setEditAttendanceForm((prev) => ({
                          ...prev,
                          error: "Status harus dipilih",
                        }));
                        return;
                      }
                      if (!editAttendanceForm.date) {
                        setEditAttendanceForm((prev) => ({
                          ...prev,
                          error: "Tanggal harus diisi",
                        }));
                        return;
                      }
                      if (!editAttendanceForm.time) {
                        setEditAttendanceForm((prev) => ({
                          ...prev,
                          error: "Jam harus diisi",
                        }));
                        return;
                      }

                      setEditAttendanceForm((prev) => ({
                        ...prev,
                        loading: true,
                      }));

                      try {
                        const payload: any = {
                          action: "editAttendance",
                          originalDate: editAttendance!.date, // ✅ Tanggal lama (untuk cari data)
                          date: editAttendanceForm.date, // ✅ Tanggal baru
                          time: editAttendanceForm.time, // ✅ Jam baru
                          nisn: editAttendance!.nisn,
                          mapel: editAttendance!.mapel,
                          newStatus: editAttendanceForm.status,
                        };

                        // Kirim foto hanya jika status = "Hadir"
                        if (
                          editAttendanceForm.status === "Hadir" &&
                          editAttendanceForm.photoBase64
                        ) {
                          payload.photo = editAttendanceForm.photoBase64;
                        }

                        const response = await fetch(ENDPOINT, {
                          method: "POST",
                          mode: "no-cors",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });

                        if (response.type === "opaque") {
                          // Update local state
                          setAttendanceData((prev) =>
                            prev.map((att) =>
                              att.nisn === editAttendance!.nisn &&
                              att.date === editAttendance!.date &&
                              att.mapel === editAttendance!.mapel
                                ? {
                                    ...att,
                                    date: editAttendanceForm.date, // ✅ Update tanggal
                                    time: editAttendanceForm.time, // ✅ Update jam
                                    status: editAttendanceForm.status,
                                    photo: editAttendanceForm.photoBase64
                                      ? URL.createObjectURL(new Blob())
                                      : att.photo,
                                  }
                                : att
                            )
                          );
                          setShowEditAttendanceModal(false);
                          setEditAttendance(null);
                          setEditAttendanceForm({
                            status: "",
                            date: "",
                            time: "",
                            photoBase64: null,
                            error: "",
                            loading: false,
                          });
                          alert("Data kehadiran berhasil diperbarui!");
                        } else {
                          throw new Error("Unexpected response");
                        }
                      } catch (error: any) {
                        setEditAttendanceForm((prev) => ({
                          ...prev,
                          error: "Gagal menyimpan: " + error.message,
                          loading: false,
                        }));
                      }
                    }}
                    disabled={editAttendanceForm.loading}
                    className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  >
                    {editAttendanceForm.loading ? "⏳ Menyimpan..." : "Simpan"}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditAttendanceModal(false);
                      setEditAttendance(null);
                      setEditAttendanceForm({
                        status: "",
                        date: "",
                        time: "",
                        photoBase64: null,
                        error: "",
                        loading: false,
                      });
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Modal Konfirmasi Hapus Absensi */}
        {showDeleteAttendanceModal && deleteAttendanceId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
              <p className="mb-4">
                Apakah Anda yakin ingin menghapus data absensi ini?
              </p>
              <div className="text-sm text-gray-600 mb-4">
                <p>
                  <strong>NISN:</strong> {deleteAttendanceId.nisn}
                </p>
                <p>
                  <strong>Tanggal:</strong> {deleteAttendanceId.date}
                </p>
                <p>
                  <strong>Mapel:</strong>{" "}
                  {deleteAttendanceId.mapel || "Belum dipilih"}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteAttendance}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
                >
                  {loading ? "⏳ Menghapus..." : "Hapus"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteAttendanceModal(false);
                    setDeleteAttendanceId(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStudentsPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Data Siswa</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setStudentForm({
                nisn: "",
                name: "",
                class: "",
                error: "",
                loading: false,
              });
              setShowAddModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Tambah Siswa
          </button>
          {studentData.length > 0 && ( // Tambahkan kondisi ini agar tombol hanya muncul jika ada data
            <button
              onClick={() => setShowDeleteAllModal(true)} // Perbaiki: hapus } ekstra
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
            >
              Hapus Semua Siswa
            </button>
          )}
          {/* Tambahkan tombol download di sini */}
          <button
            onClick={handleDownloadTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
          >
            Download Template Excel
          </button>
        </div>
      </div>
      {/* Tambahkan bagian import di sini */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Import Data Siswa dari Excel (Header: NISN, Nama, Kelas)
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="p-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={handleImportExcel}
            disabled={importLoading || !importFile}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 disabled:opacity-50"
          >
            {importLoading ? "⏳ Mengimpor..." : "Import"}
          </button>
        </div>
        {importError && (
          <div className="mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
            {importError}
          </div>
        )}
      </div>

      {studentForm.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {studentForm.error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs uppercase bg-gray-200">
            <tr>
              <th className="px-4 py-2">NISN</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Kelas</th>
              <th className="px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {studentData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada data siswa
                </td>
              </tr>
            ) : (
              studentData.map((student, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{student.nisn}</td>
                  <td className="px-4 py-2">{student.name}</td>
                  <td className="px-4 py-2">{student.class}</td>
                  <td className="px-4 py-2 flex space-x-2">
                    <button
                      onClick={() => {
                        setEditStudent(student);
                        setStudentForm({
                          nisn: student.nisn,
                          name: student.name,
                          class: student.class,
                          error: "",
                          loading: false,
                        });
                        setShowEditModal(true);
                      }}
                      className="bg-yellow-600 text-white px-3 py-1 rounded-lg hover:bg-yellow-700 transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteStudentNisn(student.nisn);
                        setShowDeleteModal(true);
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition duration-200"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Tambah Siswa</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nisn"
                value={studentForm.nisn}
                onChange={handleStudentInputChange}
                placeholder="NISN"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={studentForm.name}
                onChange={handleStudentInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="class"
                value={studentForm.class}
                onChange={handleStudentInputChange}
                placeholder="Kelas"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {studentForm.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {studentForm.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleAddStudent}
                  disabled={studentForm.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {studentForm.loading ? "⏳ Menyimpan..." : "Simpan"}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Siswa</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nisn"
                value={studentForm.nisn}
                onChange={handleStudentInputChange}
                placeholder="NISN"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={studentForm.name}
                onChange={handleStudentInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="class"
                value={studentForm.class}
                onChange={handleStudentInputChange}
                placeholder="Kelas"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {studentForm.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {studentForm.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleEditStudent}
                  disabled={studentForm.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {studentForm.loading ? "⏳ Memperbarui..." : "Perbarui"}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditStudent(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
            <p className="mb-4">
              Apakah Anda yakin ingin menghapus data siswa ini?
            </p>
            {studentForm.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4">
                {studentForm.error}
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteStudent}
                disabled={studentForm.loading}
                className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
              >
                {studentForm.loading ? "⏳ Menghapus..." : "Hapus"}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal - Pindahkan ke sini */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              Konfirmasi Hapus Semua
            </h2>
            <p className="mb-4">
              Apakah Anda yakin ingin menghapus SEMUA data siswa? Tindakan ini
              tidak dapat dibatalkan.
            </p>
            {studentForm.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4">
                {studentForm.error}
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteAllStudents}
                disabled={studentForm.loading}
                className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
              >
                {studentForm.loading ? "⏳ Menghapus..." : "Hapus Semua"}
              </button>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMonthlyRecapPage = () => {
    // Ambil kelas unik dari studentData untuk dropdown
    const uniqueClasses = [
      "Semua",
      ...new Set(studentData.map((s) => s.class)),
    ];

    const filteredNames = [
      "Semua",
      ...new Set(
        monthlyRecapData
          .filter(
            (recap) =>
              selectedClassRecap === "Semua" ||
              recap.class === selectedClassRecap
          )
          .map((recap) => recap.name)
      ),
    ];

    // Filter data berdasarkan kelas dan nama
    const filteredData = monthlyRecapData.filter((recap) => {
      const classMatch =
        selectedClassRecap === "Semua" || recap.class === selectedClassRecap;
      const nameMatch =
        selectedNameRecap === "Semua" || recap.name === selectedNameRecap;
      return classMatch && nameMatch;
    });

    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Rekap Absensi Bulanan
          </h2>
          <button
            id="downloadPdfRecapButton"
            onClick={downloadPDFRecap}
            disabled={loadingRecap || filteredData.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download PDF
          </button>
        </div>

        {/* Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bulan
            </label>
            <select
              value={selectedMonthRecap}
              onChange={(e) => setSelectedMonthRecap(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[
                "Januari",
                "Februari",
                "Maret",
                "April",
                "Mei",
                "Juni",
                "Juli",
                "Agustus",
                "September",
                "Oktober",
                "November",
                "Desember",
              ].map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kelas
            </label>
            <select
              value={selectedClassRecap}
              onChange={(e) => setSelectedClassRecap(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Siswa
            </label>
            <select
              value={selectedNameRecap}
              onChange={(e) => setSelectedNameRecap(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingRecap ? (
          <div className="text-center py-8">⏳ Memuat data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs uppercase bg-gray-200">
                <tr>
                  <th className="px-4 py-2">Nama</th>
                  <th className="px-4 py-2">Kelas</th>
                  <th className="px-4 py-2">Hadir</th>
                  <th className="px-4 py-2">Alpa</th>
                  <th className="px-4 py-2">Izin</th>
                  <th className="px-4 py-2">Sakit</th>
                  <th className="px-4 py-2">% Hadir</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada data rekap untuk filter ini
                    </td>
                  </tr>
                ) : (
                  filteredData.map((recap, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{recap.name}</td>
                      <td className="px-4 py-2">{recap.class}</td>
                      <td className="px-4 py-2">{recap.hadir}</td>
                      <td className="px-4 py-2">{recap.alpa}</td>
                      <td className="px-4 py-2">{recap.izin}</td>
                      <td className="px-4 py-2">{recap.sakit}</td>
                      <td className="px-4 py-2">{recap.persenHadir}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderMapelDataPage = () => {
    const handleAddMapel = async () => {
      if (!newMapelForm.mapel || newMapelForm.mapel.trim() === "") {
        setNewMapelForm({
          ...newMapelForm,
          error: "Nama mata pelajaran wajib diisi",
        });
        return;
      }

      // Cek duplikat lokal
      if (mapelData.some((m) => m.mapel === newMapelForm.mapel.trim())) {
        setNewMapelForm({
          ...newMapelForm,
          error: "Mata pelajaran sudah ada",
        });
        return;
      }

      setNewMapelForm({ ...newMapelForm, loading: true, error: "" });

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "addMapel", // ❌ TUNGGU! Ini belum ada di Apps Script!
            mapel: newMapelForm.mapel.trim(),
          }),
        });

        // JANGAN LUPA: Di Apps Script, kita belum punya fungsi addMapel!
        // Kita akan buatnya di Langkah 6.
        if (response.type === "opaque") {
          setMapelData([...mapelData, { mapel: newMapelForm.mapel.trim() }]);
          setNewMapelForm({ mapel: "", error: "", loading: false });
          setShowAddMapelModal(false);
          alert("Mata pelajaran berhasil ditambahkan!");
        } else {
          throw new Error("Unexpected response type");
        }
      } catch (error: any) {
        console.error("Error adding mapel:", error);
        setNewMapelForm({
          ...newMapelForm,
          error: `Gagal menambahkan mata pelajaran: ${error.message}`,
          loading: false,
        });
      }
    };

    const handleEditMapel = async () => {
      if (
        !editMapel ||
        !newMapelForm.mapel ||
        newMapelForm.mapel.trim() === ""
      ) {
        setNewMapelForm({
          ...newMapelForm,
          error: "Nama mata pelajaran wajib diisi",
        });
        return;
      }

      // Cek duplikat (kecuali dirinya sendiri)
      if (
        mapelData.some(
          (m) =>
            m.mapel === newMapelForm.mapel.trim() && m.mapel !== editMapel.mapel
        )
      ) {
        setNewMapelForm({
          ...newMapelForm,
          error: "Mata pelajaran sudah ada",
        });
        return;
      }

      setNewMapelForm({ ...newMapelForm, loading: true, error: "" });

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "editMapel", // ❌ BELUM ADA di Apps Script!
            originalMapel: editMapel.mapel,
            mapel: newMapelForm.mapel.trim(),
          }),
        });

        if (response.type === "opaque") {
          setMapelData(
            mapelData.map((m) =>
              m.mapel === editMapel.mapel
                ? { mapel: newMapelForm.mapel.trim() }
                : m
            )
          );
          setNewMapelForm({ mapel: "", error: "", loading: false });
          setShowEditMapelModal(false);
          setEditMapel(null);
          alert("Mata pelajaran berhasil diperbarui!");
        } else {
          throw new Error("Unexpected response type");
        }
      } catch (error: any) {
        console.error("Error editing mapel:", error);
        setNewMapelForm({
          ...newMapelForm,
          error: `Gagal memperbarui mata pelajaran: ${error.message}`,
          loading: false,
        });
      }
    };

    const handleDeleteMapel = async () => {
      if (!deleteMapelId) return;

      setNewMapelForm({ ...newMapelForm, loading: true, error: "" });

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deleteMapel", // ❌ BELUM ADA di Apps Script!
            mapel: deleteMapelId,
          }),
        });

        if (response.type === "opaque") {
          setMapelData(mapelData.filter((m) => m.mapel !== deleteMapelId));
          setShowDeleteMapelModal(false);
          setDeleteMapelId(null);
          alert("Mata pelajaran berhasil dihapus!");
        } else {
          throw new Error("Unexpected response type");
        }
      } catch (error: any) {
        console.error("Error deleting mapel:", error);
        setNewMapelForm({
          ...newMapelForm,
          error: `Gagal menghapus mata pelajaran: ${error.message}`,
          loading: false,
        });
      }
    };
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Data Mata Pelajaran
          </h2>
          <button
            onClick={() => {
              setNewMapelForm({ mapel: "", error: "", loading: false });
              setShowAddMapelModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Tambah Mapel
          </button>
        </div>

        {loadingMapel ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Memuat data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs uppercase bg-gray-200">
                <tr>
                  <th className="px-4 py-2">Mata Pelajaran</th>
                  <th className="px-4 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mapelData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada data mata pelajaran
                    </td>
                  </tr>
                ) : (
                  mapelData.map((mapel, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{mapel.mapel}</td>
                      <td className="px-4 py-2 flex space-x-2">
                        <button
                          onClick={() => {
                            setEditMapel(mapel);
                            setNewMapelForm({
                              mapel: mapel.mapel,
                              error: "",
                              loading: false,
                            });
                            setShowEditMapelModal(true);
                          }}
                          className="bg-yellow-600 text-white px-3 py-1 rounded-lg hover:bg-yellow-700 transition duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteMapelId(mapel.mapel); // Gunakan mapel sebagai ID karena tidak ada field id
                            setShowDeleteMapelModal(true);
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition duration-200"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Tambah Mapel */}
        {showAddMapelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                Tambah Mata Pelajaran
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newMapelForm.mapel}
                  onChange={(e) =>
                    setNewMapelForm({
                      ...newMapelForm,
                      mapel: e.target.value,
                      error: "",
                    })
                  }
                  placeholder="Nama Mata Pelajaran"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newMapelForm.error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                    {newMapelForm.error}
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddMapel}
                    disabled={newMapelForm.loading}
                    className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  >
                    {newMapelForm.loading ? "⏳ Menyimpan..." : "Simpan"}
                  </button>
                  <button
                    onClick={() => setShowAddMapelModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Edit Mapel */}
        {showEditMapelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                Edit Mata Pelajaran
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newMapelForm.mapel}
                  onChange={(e) =>
                    setNewMapelForm({
                      ...newMapelForm,
                      mapel: e.target.value,
                      error: "",
                    })
                  }
                  placeholder="Nama Mata Pelajaran Baru"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newMapelForm.error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                    {newMapelForm.error}
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={handleEditMapel}
                    disabled={newMapelForm.loading}
                    className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  >
                    {newMapelForm.loading ? "⏳ Memperbarui..." : "Perbarui"}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditMapelModal(false);
                      setEditMapel(null);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Mapel */}
        {showDeleteMapelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
              <p className="mb-4">
                Apakah Anda yakin ingin menghapus mata pelajaran "
                {deleteMapelId}"? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteMapel}
                  disabled={newMapelForm.loading}
                  className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
                >
                  {newMapelForm.loading ? "⏳ Menghapus..." : "Hapus"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteMapelModal(false);
                    setDeleteMapelId(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeacherDataPage = () => (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Data Guru</h2>
        <button
          onClick={() => {
            setTeacherFormState({
              nip: "",
              name: "",
              error: "",
              loading: false,
            });
            setShowAddTeacherModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200"
        >
          Tambah Guru
        </button>
      </div>

      {teacherFormState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {teacherFormState.error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs uppercase bg-gray-200">
            <tr>
              <th className="px-4 py-2">NIP</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {teacherData.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada data guru
                </td>
              </tr>
            ) : (
              teacherData.map((teacher, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{teacher.nip}</td>
                  <td className="px-4 py-2">{teacher.name}</td>
                  <td className="px-4 py-2 flex space-x-2">
                    <button
                      onClick={() => {
                        setEditTeacher(teacher);
                        setTeacherFormState({
                          nip: teacher.nip,
                          name: teacher.name,
                          error: "",
                          loading: false,
                        });
                        setShowEditTeacherModal(true);
                      }}
                      className="bg-yellow-600 text-white px-3 py-1 rounded-lg hover:bg-yellow-700 transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTeacherNip(teacher.nip);
                        setShowDeleteTeacherModal(true);
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition duration-200"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Teacher Modal */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Tambah Guru</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nip"
                value={teacherFormState.nip}
                onChange={handleTeacherFormInputChange}
                placeholder="NIP"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={teacherFormState.name}
                onChange={handleTeacherFormInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {teacherFormState.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {teacherFormState.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleAddTeacher}
                  disabled={teacherFormState.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {teacherFormState.loading ? "⏳ Menyimpan..." : "Simpan"}
                </button>
                <button
                  onClick={() => setShowAddTeacherModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {showEditTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Guru</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="nip"
                value={teacherFormState.nip}
                onChange={handleTeacherFormInputChange}
                placeholder="NIP"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                name="name"
                value={teacherFormState.name}
                onChange={handleTeacherFormInputChange}
                placeholder="Nama"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {teacherFormState.error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                  {teacherFormState.error}
                </div>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleEditTeacher}
                  disabled={teacherFormState.loading}
                  className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                >
                  {teacherFormState.loading ? "⏳ Memperbarui..." : "Perbarui"}
                </button>
                <button
                  onClick={() => {
                    setShowEditTeacherModal(false);
                    setEditTeacher(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Teacher Confirmation Modal */}
      {showDeleteTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
            <p className="mb-4">
              Apakah Anda yakin ingin menghapus data guru ini?
            </p>
            {teacherFormState.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4">
                {teacherFormState.error}
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteTeacher}
                disabled={teacherFormState.loading}
                className="flex-1 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50"
              >
                {teacherFormState.loading ? "⏳ Menghapus..." : "Hapus"}
              </button>
              <button
                onClick={() => setShowDeleteTeacherModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto w-full max-w-4xl mx-auto px-4">
        {!isLoggedIn ? (
          <>
            <h1 className="text-center text-2xl font-semibold text-gray-900 mb-6">
              {isFromPKBM
                ? "Aplikasi Absensi Siswa"
                : "Aplikasi Pengelolaan Data Kehadiran Siswa"}
            </h1>
            {renderLoginPage()}
          </>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-lg shadow-lg p-1 flex relative">
                {" "}
                {/* Tambah relative untuk positioning dropdown */}
                {userRole === "Guru" ? (
                  <>
                    {/* Tombol Hamburger untuk Guru */}
                    <button
                      onClick={toggleMenu}
                      className="px-4 py-2 rounded-md transition duration-200 text-gray-600 hover:bg-gray-100 flex items-center"
                    >
                      ≡ Menu
                    </button>
                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white shadow-lg rounded-lg p-2 z-10 w-48">
                        <button
                          onClick={() => handleMenuItemClick("teacherForm")}
                          className={`block w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                            currentPage === "teacherForm"
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          📝 Form Absensi
                        </button>
                        <button
                          onClick={() => handleMenuItemClick("data")}
                          className={`block w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                            currentPage === "data"
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          📊 Data Absensi
                        </button>
                        <button
                          onClick={() => handleMenuItemClick("students")}
                          className={`block w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                            currentPage === "students"
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          👥 Data Siswa
                        </button>
                        <button
                          onClick={() => handleMenuItemClick("monthlyRecap")}
                          className={`block w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                            currentPage === "monthlyRecap"
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          📅 Rekap Bulanan
                        </button>
                        {/* ✅ TAMBAHKAN INI: Tombol Data Mapel */}
                        <button
                          onClick={() => handleMenuItemClick("mapelData")}
                          className={`block w-full text-left px-4 py-2 rounded-md transition duration-200 ${
                            currentPage === "mapelData"
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          📚 Data Mata Pelajaran
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  // Navigasi bar biasa untuk role lain (Siswa atau Kepsek)
                  <>
                    {userRole === "Siswa" && (
                      <button
                        onClick={() => handlePageChange("form")}
                        className={`px-6 py-2 rounded-md transition duration-200 ${
                          currentPage === "form"
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        📝 Form Absensi
                      </button>
                    )}
                    {userRole === "Kepala Sekolah" && (
                      <button
                        onClick={() => handlePageChange("teacherData")}
                        className={`px-6 py-2 rounded-md transition duration-200 ${
                          currentPage === "teacherData"
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        👨‍🏫 Data Guru
                      </button>
                    )}
                  </>
                )}
                {/* Tombol Logout selalu ada */}
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 rounded-md transition duration-200 text-red-600 hover:bg-red-100"
                >
                  🚪 Logout
                </button>
              </div>
            </div>

            {currentPage === "form" && userRole === "Siswa"
              ? renderFormPage()
              : currentPage === "teacherForm" && userRole === "Guru"
              ? renderTeacherFormPage()
              : currentPage === "data" && userRole === "Guru"
              ? renderDataPage()
              : currentPage === "students" && userRole === "Guru"
              ? renderStudentsPage()
              : currentPage === "teacherData" && userRole === "Kepala Sekolah" // Tambahkan ini
              ? renderTeacherDataPage()
              : currentPage === "monthlyRecap" && userRole === "Guru"
              ? renderMonthlyRecapPage()
              : currentPage === "mapelData" && userRole === "Guru" // ✅ TAMBAHKAN INI
              ? renderMapelDataPage()
              : null}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
