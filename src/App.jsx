import React, { useState, useEffect } from 'react';

// Default Settings
const INITIAL_SETTINGS = {
  defaultHourlyRate: 20,
  defaultNightShiftPay: 150,
  defaultBreakMinutes: 30,
  taxMode: 'uk',
  taxPercentage: 20,
  monthlyGoal: 3000,
  yearlyGoal: 36000,
  ukIsSecondJob: false,
  ukBaseAnnualSalary: 0
};

// Initial Sample Data (for demonstration)
const INITIAL_SHIFTS = [
  {
    id: 'sample-1',
    date: new Date().toISOString().split('T')[0], // Today
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 30,
    hourlyRate: 20,
    note: 'Standard Day Shift',
    tag: 'Day'
  },
  {
    id: 'sample-2',
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })(), // Yesterday
    startTime: '20:00',
    endTime: '04:00',
    breakMinutes: 45,
    hourlyRate: 25,
    note: 'Night Shift with Overtime',
    tag: 'Night'
  }
];

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'settings'

  // Application Data States
  const [shifts, setShifts] = useState(() => {
    const local = localStorage.getItem('shiftly_shifts');
    return local ? JSON.parse(local) : INITIAL_SHIFTS;
  });

  const [settings, setSettings] = useState(() => {
    const local = localStorage.getItem('shiftly_settings');
    return local ? JSON.parse(local) : INITIAL_SETTINGS;
  });

  const currencySymbol = settings.taxMode === 'uk' ? '£' : '$';

  // Calendar & Drawer States
  const [currentDate, setCurrentDate] = useState(new Date()); // Holds current viewing month
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  // Form Fields
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [hourlyRate, setHourlyRate] = useState(20);
  const [isFixedPay, setIsFixedPay] = useState(false);
  const [fixedPay, setFixedPay] = useState(150);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('Day');

  // Persistence
  useEffect(() => {
    localStorage.setItem('shiftly_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('shiftly_settings', JSON.stringify(settings));
  }, [settings]);

  // Load Google AdSense script on main page mount
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="adsbygoogle"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7721292005812211';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  }, []);

  // PWA states and logic
  const [isStandalone, setIsStandalone] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIOS] = useState(() => /iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleStandaloneChange = (e) => {
      setIsStandalone(e.matches);
    };
    mediaQuery.addEventListener('change', handleStandaloneChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      mediaQuery.removeEventListener('change', handleStandaloneChange);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`PWA installation choice: ${outcome}`);
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Sync Form fields when adding/editing
  const openAddShift = (dateStr) => {
    setEditingShift(null);
    setStartTime('08:00');
    setEndTime('16:00');
    setBreakMinutes(settings.defaultBreakMinutes);
    setHourlyRate(settings.defaultHourlyRate);
    setIsFixedPay(false);
    setFixedPay(settings.defaultNightShiftPay !== undefined ? settings.defaultNightShiftPay : 150);
    setNote('');
    setTag('Day');
    setSelectedDateStr(dateStr);
    setIsDrawerOpen(true);
  };

  const openEditShift = (shift) => {
    setEditingShift(shift);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setBreakMinutes(shift.breakMinutes);
    setHourlyRate(shift.hourlyRate || 0);
    setIsFixedPay(!!shift.isFixedPay);
    setFixedPay(shift.fixedPay || (settings.defaultNightShiftPay !== undefined ? settings.defaultNightShiftPay : 150));
    setNote(shift.note || '');
    setTag(shift.tag || 'Day');
    setSelectedDateStr(shift.date);
    setIsDrawerOpen(true);
  };

  // Duration & Pay Calculations
  const calculateDurationHours = (start, end, breakMins) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Overnight shifts (e.g. 22:00 to 06:00)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    const workMinutes = endMinutes - startMinutes - breakMins;
    return Math.max(0, workMinutes / 60);
  };

  const calculateShiftPayout = (shift) => {
    if (shift.isFixedPay) {
      return shift.fixedPay || 0;
    }
    const duration = calculateDurationHours(shift.startTime, shift.endTime, shift.breakMinutes);
    return duration * (shift.hourlyRate || 0);
  };

  // Action: Save Shift
  const handleSaveShift = (e) => {
    e.preventDefault();
    const shiftData = {
      id: editingShift ? editingShift.id : 'shift-' + Date.now(),
      date: selectedDateStr,
      startTime,
      endTime,
      breakMinutes: Number(breakMinutes),
      hourlyRate: isFixedPay ? 0 : Number(hourlyRate),
      isFixedPay,
      fixedPay: isFixedPay ? Number(fixedPay) : 0,
      note,
      tag
    };

    if (editingShift) {
      setShifts(shifts.map(s => s.id === editingShift.id ? shiftData : s));
    } else {
      setShifts([...shifts, shiftData]);
    }
    setIsDrawerOpen(false);
  };

  // Action: Delete Shift
  const handleDeleteShift = (id) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      setShifts(shifts.filter(s => s.id !== id));
      setIsDrawerOpen(false);
    }
  };

  // Quick Presets Action
  const applyPreset = (presetName) => {
    let pStart = '08:00';
    let pEnd = '16:00';
    let pBreak = settings.defaultBreakMinutes;
    let pRate = settings.defaultHourlyRate;
    let pTag = 'Day';
    let pIsFixed = false;
    let pFixedPay = 0;

    if (presetName === 'Night') {
      pStart = '20:00';
      pEnd = '04:00';
      pBreak = 45;
      pRate = 0;
      pIsFixed = true;
      pFixedPay = settings.defaultNightShiftPay !== undefined ? settings.defaultNightShiftPay : 150;
      pTag = 'Night';
    } else if (presetName === 'Late') {
      pStart = '14:00';
      pEnd = '22:00';
      pBreak = 30;
      pRate = settings.defaultHourlyRate;
      pTag = 'Late';
    }

    const newShift = {
      id: 'shift-' + Date.now(),
      date: selectedDateStr,
      startTime: pStart,
      endTime: pEnd,
      breakMinutes: pBreak,
      hourlyRate: pRate,
      isFixedPay: pIsFixed,
      fixedPay: pFixedPay,
      note: `${presetName} Shift Preset`,
      tag: pTag
    };

    // Remove any existing shift on this date to replace it, or add it
    const filtered = shifts.filter(s => s.date !== selectedDateStr);
    setShifts([...filtered, newShift]);
  };

  // HMRC Monthly & Annual UK Tax & NI Calculator
  // Tax Year 2026/2027 Monthly thresholds:
  // Personal Allowance: £12,570/yr -> £1,047.50/mo
  // Basic Rate (20%): £1,047.50 to £4,189.17/mo (£50,270/yr)
  // Higher Rate (40%): £4,189.17 to £10,428.33/mo (£125,140/yr)
  // Additional Rate (45%): Above £10,428.33/mo
  // Class 1 NI (Monthly): 0% up to £1,047.50; 8% from £1,047.50 to £4,189.17; 2% above £4,189.17
  const calculateMonthlyUKTaxAndNI = (monthlyGross, overrideBaseSalary = null, overrideIsSecondJob = null) => {
    if (monthlyGross <= 0) return { incomeTax: 0, ni: 0, totalTax: 0, net: 0, effectiveRate: 0 };

    const isSecondJob = overrideIsSecondJob !== null ? overrideIsSecondJob : !!settings.ukIsSecondJob;
    const baseAnnualSalary = overrideBaseSalary !== null ? overrideBaseSalary : (Number(settings.ukBaseAnnualSalary) || 0);
    const monthlyBase = baseAnnualSalary / 12;

    let incomeTax = 0;
    let ni = 0;

    const computeStandardMonthlyTax = (gross) => {
      let tax = 0;
      const taxable = Math.max(0, gross - 1047.50);
      if (taxable > 0) {
        if (gross <= 4189.17) {
          tax = taxable * 0.20;
        } else if (gross <= 10428.33) {
          const basic = 4189.17 - 1047.50;
          const higher = gross - 4189.17;
          tax = (basic * 0.20) + (higher * 0.40);
        } else {
          const basic = 4189.17 - 1047.50;
          const higher = 10428.33 - 4189.17;
          const additional = gross - 10428.33;
          tax = (basic * 0.20) + (higher * 0.40) + (additional * 0.45);
        }
      }
      return tax;
    };

    if (isSecondJob) {
      // Tax Code BR (20% flat tax on shift earnings from £1)
      const combinedMonthly = monthlyBase + monthlyGross;
      if (combinedMonthly <= 4189.17) {
        incomeTax = monthlyGross * 0.20;
      } else {
        const taxableAtBasic = Math.max(0, 4189.17 - monthlyBase);
        const taxableAtHigher = monthlyGross - taxableAtBasic;
        incomeTax = Math.max(0, taxableAtBasic) * 0.20 + Math.max(0, taxableAtHigher) * 0.40;
      }

      // Class 1 NI threshold per job (£1,047.50/mo)
      if (monthlyGross > 1047.50) {
        if (monthlyGross <= 4189.17) {
          ni = (monthlyGross - 1047.50) * 0.08;
        } else {
          ni = ((4189.17 - 1047.50) * 0.08) + ((monthlyGross - 4189.17) * 0.02);
        }
      }
    } else if (baseAnnualSalary > 0) {
      // Marginal calculation on top of main job salary
      const taxOnBase = computeStandardMonthlyTax(monthlyBase);
      const taxOnTotal = computeStandardMonthlyTax(monthlyBase + monthlyGross);
      incomeTax = Math.max(0, taxOnTotal - taxOnBase);

      // Class 1 NI per job (£1,047.50/mo)
      if (monthlyGross > 1047.50) {
        if (monthlyGross <= 4189.17) {
          ni = (monthlyGross - 1047.50) * 0.08;
        } else {
          ni = ((4189.17 - 1047.50) * 0.08) + ((monthlyGross - 4189.17) * 0.02);
        }
      }
    } else {
      // Primary job monthly PAYE calculation
      incomeTax = computeStandardMonthlyTax(monthlyGross);

      // Class 1 NI per job (£1,047.50/mo)
      if (monthlyGross > 1047.50) {
        if (monthlyGross <= 4189.17) {
          ni = (monthlyGross - 1047.50) * 0.08;
        } else {
          ni = ((4189.17 - 1047.50) * 0.08) + ((monthlyGross - 4189.17) * 0.02);
        }
      }
    }

    const totalTax = incomeTax + ni;
    const net = monthlyGross - totalTax;
    const effectiveRate = (totalTax / monthlyGross) * 100;

    return { incomeTax, ni, totalTax, net, effectiveRate };
  };

  // Financial Projections
  const now = new Date();

  // Shifts in the selected date's month
  const getSelectedMonthShifts = () => {
    const [year, month] = selectedDateStr.split('-').map(Number);
    return shifts.filter(s => {
      const sDate = new Date(s.date);
      return sDate.getFullYear() === year && sDate.getMonth() === (month - 1);
    });
  };

  const selectedMonthShifts = getSelectedMonthShifts();

  // Total earned for active month
  const monthlyGross = selectedMonthShifts.reduce((sum, s) => sum + calculateShiftPayout(s), 0);

  // Tax Year computations (Starts April 6th)
  const activeDate = new Date(selectedDateStr);
  const taxYearRange = (() => {
    const y = activeDate.getFullYear();
    const taxYearStart = new Date(y, 3, 6); // April 6th
    if (activeDate >= taxYearStart) {
      return {
        start: new Date(y, 3, 6),
        end: new Date(y + 1, 3, 5),
        label: `Tax Year ${y}/${(y + 1).toString().slice(-2)}`
      };
    } else {
      return {
        start: new Date(y - 1, 3, 6),
        end: new Date(y, 3, 5),
        label: `Tax Year ${y - 1}/${y.toString().slice(-2)}`
      };
    }
  })();

  const taxYearShifts = shifts.filter(s => {
    const sDate = new Date(s.date);
    return sDate >= taxYearRange.start && sDate <= taxYearRange.end;
  });

  const yearlyGross = taxYearShifts.reduce((sum, s) => sum + calculateShiftPayout(s), 0);

  // Annualized Projection logic:
  // (Total earned year-to-date / days elapsed in year) * 365
  const calculateYearlyForecast = () => {
    if (taxYearShifts.length === 0) return 0;
    
    const startOfTax = taxYearRange.start;
    const endOfTax = taxYearRange.end;
    let referenceDate = now;
    if (now > endOfTax) {
      referenceDate = endOfTax;
    } else if (now < startOfTax) {
      referenceDate = startOfTax;
    }

    const diffTime = Math.abs(referenceDate - startOfTax);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    const earnedToDate = yearlyGross;
    return Math.round((earnedToDate / diffDays) * 365);
  };
  
  const annualizedForecastGross = calculateYearlyForecast();

  const getMonthlyBreakdown = () => {
    const startYear = taxYearRange.start.getFullYear();
    const months = [
      { name: 'Apr', year: startYear, monthNum: 3 },
      { name: 'May', year: startYear, monthNum: 4 },
      { name: 'Jun', year: startYear, monthNum: 5 },
      { name: 'Jul', year: startYear, monthNum: 6 },
      { name: 'Aug', year: startYear, monthNum: 7 },
      { name: 'Sep', year: startYear, monthNum: 8 },
      { name: 'Oct', year: startYear, monthNum: 9 },
      { name: 'Nov', year: startYear, monthNum: 10 },
      { name: 'Dec', year: startYear, monthNum: 11 },
      { name: 'Jan', year: startYear + 1, monthNum: 0 },
      { name: 'Feb', year: startYear + 1, monthNum: 1 },
      { name: 'Mar', year: startYear + 1, monthNum: 2 }
    ];

    return months.map(m => {
      // Filter shifts for this month
      const monthShifts = shifts.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getFullYear() === m.year && sDate.getMonth() === m.monthNum;
      });

      const gross = monthShifts.reduce((sum, s) => sum + calculateShiftPayout(s), 0);
      
      // Calculate net
      let net = gross * (1 - settings.taxPercentage / 100);
      if (settings.taxMode === 'uk') {
        const ukM = calculateMonthlyUKTaxAndNI(gross);
        net = ukM.net;
      }

      return {
        ...m,
        shiftsCount: monthShifts.length,
        gross,
        net
      };
    });
  };

  // Calculate Net Values depending on Tax Mode
  let effectiveTaxRate = settings.taxPercentage; // Default simple
  let monthlyNet = monthlyGross * (1 - effectiveTaxRate / 100);
  let yearlyNet = yearlyGross * (1 - effectiveTaxRate / 100);
  let annualizedForecastNet = annualizedForecastGross * (1 - effectiveTaxRate / 100);

  // Detailed tax/NI breakdown declarations
  let monthlyTax = monthlyGross * (settings.taxPercentage / 100);
  let monthlyNI = 0;
  let yearlyTax = yearlyGross * (settings.taxPercentage / 100);
  let yearlyNI = 0;
  let annualizedForecastTax = annualizedForecastGross * (settings.taxPercentage / 100);
  let annualizedForecastNI = 0;

  if (settings.taxMode === 'uk') {
    // 1. Calculate actual UK Tax & NI on current selected month
    const ukMonthly = calculateMonthlyUKTaxAndNI(monthlyGross);
    effectiveTaxRate = ukMonthly.effectiveRate;
    monthlyNet = ukMonthly.net;
    monthlyTax = ukMonthly.incomeTax;
    monthlyNI = ukMonthly.ni;

    // 2. Sum monthly Tax & NI for all months in the tax year
    let calcYearlyTax = 0;
    let calcYearlyNI = 0;
    let calcYearlyNet = 0;

    const startYear = taxYearRange.start.getFullYear();
    const taxYearMonths = [
      { year: startYear, monthNum: 3 },
      { year: startYear, monthNum: 4 },
      { year: startYear, monthNum: 5 },
      { year: startYear, monthNum: 6 },
      { year: startYear, monthNum: 7 },
      { year: startYear, monthNum: 8 },
      { year: startYear, monthNum: 9 },
      { year: startYear, monthNum: 10 },
      { year: startYear, monthNum: 11 },
      { year: startYear + 1, monthNum: 0 },
      { year: startYear + 1, monthNum: 1 },
      { year: startYear + 1, monthNum: 2 }
    ];

    taxYearMonths.forEach(m => {
      const mShifts = shifts.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getFullYear() === m.year && sDate.getMonth() === m.monthNum;
      });
      const mGross = mShifts.reduce((sum, s) => sum + calculateShiftPayout(s), 0);
      const mUk = calculateMonthlyUKTaxAndNI(mGross);
      calcYearlyTax += mUk.incomeTax;
      calcYearlyNI += mUk.ni;
      calcYearlyNet += mUk.net;
    });

    yearlyTax = calcYearlyTax;
    yearlyNI = calcYearlyNI;
    yearlyNet = calcYearlyNet;

    // 3. For annualized forecast, compute tax on monthly equivalent
    const monthlyForecastGross = annualizedForecastGross / 12;
    const ukForecastMonthly = calculateMonthlyUKTaxAndNI(monthlyForecastGross);
    annualizedForecastTax = ukForecastMonthly.incomeTax * 12;
    annualizedForecastNI = ukForecastMonthly.ni * 12;
    annualizedForecastNet = ukForecastMonthly.net * 12;
  }

  // Calendar Helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction) => {
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(nextDate);
  };

  // Build calendar cells
  const buildCalendarCells = () => {
    const daysCount = getDaysInMonth(currentDate);
    const startDay = getFirstDayOfMonth(currentDate);
    const cells = [];

    // Empty cells for alignment
    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days in the month
    for (let day = 1; day <= daysCount; day++) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const cellDateStr = `${year}-${month}-${dayStr}`;

      const hasShift = shifts.some(s => s.date === cellDateStr);
      const isSelected = selectedDateStr === cellDateStr;
      const isToday = new Date().toISOString().split('T')[0] === cellDateStr;

      cells.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => {
            setSelectedDateStr(cellDateStr);
            // If there's a shift, open edit. If not, don't open drawer automatically,
            // let user click "Add Shift" or tap quick presets.
          }}
        >
          {day}
          {hasShift && <span className="day-shift-dot"></span>}
        </div>
      );
    }

    return cells;
  };

  // Data Export / Import
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ shifts, settings }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `shiftly_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.shifts && Array.isArray(parsed.shifts)) {
          setShifts(parsed.shifts);
        }
        if (parsed.settings) {
          setSettings({ ...settings, ...parsed.settings });
        }
        alert('Data successfully imported!');
      } catch (err) {
        alert('Invalid backup file structure.');
      }
    };
    fileReader.readAsText(file);
  };

  // Format Helpers
  const formatCurrency = (val) => {
    const isUK = settings.taxMode === 'uk';
    return new Intl.NumberFormat(isUK ? 'en-GB' : 'en-US', { 
      style: 'currency', 
      currency: isUK ? 'GBP' : 'USD' 
    }).format(val);
  };

  const formatMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Selected date's shifts
  const selectedDateShifts = shifts.filter(s => s.date === selectedDateStr);

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">S</span>
          <span className="logo-text">Shiftly</span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}
          onClick={() => openAddShift(selectedDateStr)}
        >
          + Add Shift
        </button>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        
        {/* VIEW 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="fade-in-slide" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* KPI Overview */}
            <div className="kpi-grid">
              
              <div className="kpi-card glass full-width">
                <div className="kpi-label">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Monthly Net Earnings ({new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'short' })})
                </div>
                <div className="kpi-value text-success">{formatCurrency(monthlyNet)}</div>
                <div className="kpi-subtext">
                  Gross (Overall Pay): {formatCurrency(monthlyGross)} {settings.taxMode === 'uk' ? `(after ~${effectiveTaxRate.toFixed(1)}% est. UK tax & NI)` : `(after ${settings.taxPercentage}% tax)`}
                </div>
                {settings.taxMode === 'uk' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                    {(monthlyTax + monthlyNI === 0 && monthlyGross > 0 && !settings.ukIsSecondJob && !settings.ukBaseAnnualSalary) ? (
                      <div style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.2)', fontSize: '11px', lineHeight: '1.3' }}>
                        <strong>💡 £0 UK Tax:</strong> Monthly earnings are below HMRC's £1,047.50/mo allowance. Have another job? Enable <strong>Secondary Job</strong> in Settings.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Est. Income Tax:</span>
                          <span>-{formatCurrency(monthlyTax)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Est. National Insurance:</span>
                          <span>-{formatCurrency(monthlyNI)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="progress-container">
                  <div 
                    className="progress-bar success" 
                    style={{ width: `${Math.min(100, (monthlyNet / settings.monthlyGoal) * 100)}%` }}
                  ></div>
                </div>
                <div className="kpi-subtext" style={{ marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Goal Net: {formatCurrency(settings.monthlyGoal)}</span>
                  <span>{Math.round((monthlyNet / settings.monthlyGoal) * 100)}%</span>
                </div>
              </div>

              <div className="kpi-card glass">
                <div className="kpi-label">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  Tax Year Net ({taxYearRange.label.replace('Tax Year ', '')})
                </div>
                <div className="kpi-value text-primary">{formatCurrency(yearlyNet)}</div>
                <div className="kpi-subtext">Gross: {formatCurrency(yearlyGross)}</div>
                {settings.taxMode === 'uk' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tax: -{formatCurrency(yearlyTax)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>NI: -{formatCurrency(yearlyNI)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="kpi-card glass">
                <div className="kpi-label">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                  Projected Net Est.
                </div>
                <div className="kpi-value text-warning">{formatCurrency(annualizedForecastNet)}</div>
                <div className="kpi-subtext">Gross Est: {formatCurrency(annualizedForecastGross)}</div>
                {settings.taxMode === 'uk' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tax: -{formatCurrency(annualizedForecastTax)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>NI: -{formatCurrency(annualizedForecastNI)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Presets / Quick Log */}
            <div>
              <div className="section-title">
                <span>Quick Log Preset</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>On {new Date(selectedDateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="presets-container">
                <div className="preset-chip glass" onClick={() => applyPreset('Day')}>
                  <div className="preset-icon">☀️</div>
                  <div className="preset-info">
                    <span className="preset-name">Day Shift</span>
                    <span className="preset-rate">08:00 - 16:00 @ {formatCurrency(settings.defaultHourlyRate)}/h</span>
                  </div>
                </div>
                <div className="preset-chip glass" onClick={() => applyPreset('Late')}>
                  <div className="preset-icon">🌆</div>
                  <div className="preset-info">
                    <span className="preset-name">Late Shift</span>
                    <span className="preset-rate">14:00 - 22:00 @ {formatCurrency(settings.defaultHourlyRate)}/h</span>
                  </div>
                </div>
                <div className="preset-chip glass" onClick={() => applyPreset('Night')}>
                  <div className="preset-icon">🌙</div>
                  <div className="preset-info">
                    <span className="preset-name">Night Shift</span>
                    <span className="preset-rate">20:00 - 04:00 @ {formatCurrency(settings.defaultNightShiftPay !== undefined ? settings.defaultNightShiftPay : 150)} (Fixed)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Earnings Breakdown */}
            <div>
              <div className="section-title">
                <span>Monthly Earnings ({taxYearRange.label})</span>
              </div>
              <div className="settings-section" style={{ padding: '16px', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Month</span>
                  <span style={{ textAlign: 'center' }}>Shifts</span>
                  <span style={{ textAlign: 'right' }}>Gross</span>
                  <span style={{ textAlign: 'right' }}>Net Est.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {getMonthlyBreakdown().map(m => (
                    <div 
                      key={`${m.name}-${m.year}`} 
                      className="settings-row" 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 1fr 2fr 2fr', 
                        gap: '8px', 
                        fontSize: '13px', 
                        padding: '6px 0', 
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontWeight: '500' }}>{m.name} {m.year}</span>
                      <span style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{m.shiftsCount}</span>
                      <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(m.gross)}</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: '600' }}>{formatCurrency(m.net)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Date Shifts */}
            <div>
              <h3 className="section-title" style={{ marginBottom: '12px' }}>
                Shifts on {new Date(selectedDateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </h3>
              
              {selectedDateShifts.length === 0 ? (
                <div className="empty-state">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <p className="empty-state-text">No shifts logged for this day.</p>
                  <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => openAddShift(selectedDateStr)}>
                    Add Shift Manual
                  </button>
                </div>
              ) : (
                <div className="shifts-list-container">
                  {selectedDateShifts.map(s => (
                    <div key={s.id} className="shift-card glass" onClick={() => openEditShift(s)}>
                      <div className="shift-details">
                        <div className="shift-title-row">
                          <span className="shift-time">{s.startTime} - {s.endTime}</span>
                          <span className="shift-tag">{s.tag}</span>
                        </div>
                        <span className="shift-sub">
                          <span>{calculateDurationHours(s.startTime, s.endTime, s.breakMinutes).toFixed(1)} hrs worked</span>
                          <span>•</span>
                          <span>Break: {s.breakMinutes}m</span>
                        </span>
                        {s.note && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>"{s.note}"</span>}
                      </div>
                      <div className="shift-payout-section">
                        <span className="shift-pay">{formatCurrency(calculateShiftPayout(s))}</span>
                        <span className="shift-net-pay">Net: {formatCurrency(calculateShiftPayout(s) * (1 - effectiveTaxRate / 100))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="fade-in-slide" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Custom Monthly Calendar Card */}
            <div className="calendar-card glass">
              <div className="calendar-header">
                <button className="calendar-nav-btn" onClick={() => navigateMonth(-1)}>←</button>
                <div className="calendar-title">{formatMonthName(currentDate)}</div>
                <button className="calendar-nav-btn" onClick={() => navigateMonth(1)}>→</button>
              </div>

              <div className="calendar-weekdays">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>

              <div className="calendar-grid">
                {buildCalendarCells()}
              </div>
            </div>

            {/* Quick Presets Section inside Calendar tab */}
            <div>
              <div className="section-title">
                <span>Add Preset to Selected Day</span>
              </div>
              <div className="presets-container" style={{ paddingBottom: '0' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => applyPreset('Day')}>☀️ Day Shift</button>
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => applyPreset('Late')}>🌆 Late Shift</button>
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => applyPreset('Night')}>🌙 Night Shift</button>
              </div>
            </div>

            {/* Shifts logged for the selected day */}
            <div>
              <h3 className="section-title" style={{ marginBottom: '12px' }}>
                Shifts on {new Date(selectedDateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
              </h3>
              {selectedDateShifts.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No shifts logged for this day.</p>
                  <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => openAddShift(selectedDateStr)}>
                    Create Custom Shift
                  </button>
                </div>
              ) : (
                <div className="shifts-list-container">
                  {selectedDateShifts.map(s => (
                    <div key={s.id} className="shift-card glass" onClick={() => openEditShift(s)}>
                      <div className="shift-details">
                        <div className="shift-title-row">
                          <span className="shift-time">{s.startTime} - {s.endTime}</span>
                          <span className="shift-tag">{s.tag}</span>
                        </div>
                        <span className="shift-sub">
                          <span>{calculateDurationHours(s.startTime, s.endTime, s.breakMinutes).toFixed(1)} hrs worked</span>
                          <span>•</span>
                          <span>Break: {s.breakMinutes}m</span>
                        </span>
                      </div>
                      <div className="shift-payout-section">
                        <span className="shift-pay">{formatCurrency(calculateShiftPayout(s))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 3: SETTINGS & BACKUP */}
        {activeTab === 'settings' && (
          <div className="fade-in-slide" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Preferences Setup */}
            <div className="settings-section">
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Work Profile & Defaults</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Default Hourly Rate ({currencySymbol})</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={settings.defaultHourlyRate}
                    onChange={(e) => setSettings({ ...settings, defaultHourlyRate: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Night Shift Pay (Fixed, {currencySymbol})</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={settings.defaultNightShiftPay !== undefined ? settings.defaultNightShiftPay : 150}
                    onChange={(e) => setSettings({ ...settings, defaultNightShiftPay: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Default Break (mins)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={settings.defaultBreakMinutes}
                    onChange={(e) => setSettings({ ...settings, defaultBreakMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Goal ($)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={settings.monthlyGoal}
                    onChange={(e) => setSettings({ ...settings, monthlyGoal: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tax Calculation Mode</label>
                <select 
                  className="input-field" 
                  value={settings.taxMode || 'uk'}
                  onChange={(e) => setSettings({ ...settings, taxMode: e.target.value })}
                >
                  <option value="uk">UK Income Tax & NI Bands</option>
                  <option value="simple">Simple Percentage</option>
                </select>
              </div>

              {(settings.taxMode === 'simple') ? (
                <div className="form-group">
                  <div className="settings-row">
                    <div className="settings-info">
                      <span className="settings-title">Tax Estimation Percentage</span>
                      <span className="settings-description">Subtracted automatically to calculate net pay estimates</span>
                    </div>
                  </div>
                  <div className="slider-container" style={{ marginTop: '8px' }}>
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      className="slider-input" 
                      value={settings.taxPercentage}
                      onChange={(e) => setSettings({ ...settings, taxPercentage: Number(e.target.value) })}
                    />
                    <span className="slider-value">{settings.taxPercentage}%</span>
                  </div>
                </div>
              ) : (
                <div className="settings-section" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', margin: '0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🇬🇧 UK PAYE & National Insurance Configuration
                  </div>

                  {/* Toggle for Second Job / Tax Code BR */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary-color)' }}
                      checked={!!settings.ukIsSecondJob}
                      onChange={(e) => setSettings({ ...settings, ukIsSecondJob: e.target.checked })}
                    />
                    <div>
                      <span style={{ fontWeight: 600 }}>This is a secondary job / Tax Code BR</span>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: '1.3' }}>
                        Check this if your £12,570 Personal Allowance is used by your primary employer. Applies 20% flat Tax on shift earnings (Class 1 NI applies over £1,047.50/mo per employer).
                      </p>
                    </div>
                  </label>

                  {/* Input for Base Annual Salary if not second job */}
                  {!settings.ukIsSecondJob && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                        Main Job Base Annual Salary (£) <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(Optional)</span>
                      </label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="e.g. 25000"
                        value={settings.ukBaseAnnualSalary || ''}
                        onChange={(e) => setSettings({ ...settings, ukBaseAnnualSalary: e.target.value ? Number(e.target.value) : 0 })}
                      />
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.3' }}>
                        Enter your primary annual income to calculate marginal UK tax & NI on top of your existing salary.
                      </p>
                    </div>
                  )}

                  {/* Active Tax Summary Card */}
                  <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>HMRC Monthly Thresholds:</strong><br />
                    • Monthly Personal Allowance: £1,047.50 / month (£12,570/yr)<br />
                    • Basic Rate Tax (20%): £1,047.50 – £4,189.17 / month<br />
                    • Class 1 NI (8%): Above £1,047.50 / month per job
                  </div>
                </div>
              )}
            </div>

            {/* App Shortcut (PWA Installation) */}
            {!isStandalone && (
              <div className="settings-section">
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>App Shortcut</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Install Shiftly to your device's home screen for quick, offline-ready access just like a native app.
                </p>
                {installPrompt ? (
                  <button className="btn btn-primary btn-full" onClick={handleInstallPWA} style={{ marginTop: '8px' }}>
                    📱 Add Shortcut / Install App
                  </button>
                ) : isIOS ? (
                  <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '12px', color: 'var(--text-primary)', marginTop: '8px', lineHeight: '1.5' }}>
                    <strong>iOS / iPhone Setup:</strong><br />
                    1. Tap the <strong>Share</strong> icon <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '16px', height: '16px', display: 'inline', verticalAlign: 'middle', margin: '0 2px' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> in Safari's bottom toolbar.<br />
                    2. Scroll down and select <strong>Add to Home Screen</strong> from the menu.
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
                    To add this app to your home screen: click your browser's menu button (usually three dots <span style={{ fontWeight: 'bold' }}>⋮</span> or sharing icon) and select <strong>Add to Home Screen</strong> or <strong>Install App</strong>.
                  </div>
                )}
              </div>
            )}

            {/* Backup & Import */}
            <div className="settings-section">
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Backup and Data Portability</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                All your shift records are stored locally on your device. Keep a backup file in case you clean your browser cookies.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <button className="btn btn-secondary btn-full" onClick={handleExportData}>
                  📥 Export Shifts Backup (JSON)
                </button>
                
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    id="import-file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleImportData}
                  />
                  <label htmlFor="import-file" className="btn btn-secondary btn-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📤 Import Shifts Backup (JSON)
                  </label>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              <p>Shiftly v1.0.0 • Private & Offline-first</p>
            </div>

          </div>
        )}

      </main>

      {/* Slide-up Editor Drawer */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}>
        <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <h3 className="drawer-title">{editingShift ? 'Edit Shift Details' : 'Add New Shift'}</h3>
            <button className="drawer-close" onClick={() => setIsDrawerOpen(false)}>✕</button>
          </div>

          <form onSubmit={handleSaveShift} className="drawer-form">
            <div className="drawer-body">
              <div className="form-group">
                <label className="form-label">Shift Tag / Name</label>
                <select 
                  className="input-field" 
                  value={tag} 
                  onChange={(e) => {
                    const newTag = e.target.value;
                    setTag(newTag);
                    if (newTag === 'Night') {
                      setIsFixedPay(true);
                    } else if (newTag === 'Day' || newTag === 'Late') {
                      setIsFixedPay(false);
                    }
                  }}
                >
                  <option value="Day">☀️ Day Shift</option>
                  <option value="Late">🌆 Late Shift</option>
                  <option value="Night">🌙 Night Shift</option>
                  <option value="Custom">⚙️ Custom Shift</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={startTime} 
                    required
                    onChange={(e) => setStartTime(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={endTime} 
                    required
                    onChange={(e) => setEndTime(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Unpaid Break (mins)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={breakMinutes} 
                    required
                    onChange={(e) => setBreakMinutes(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{isFixedPay ? `Fixed Pay (${currencySymbol})` : `Hourly Rate (${currencySymbol})`}</label>
                  {isFixedPay ? (
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-field" 
                      value={fixedPay} 
                      required
                      onChange={(e) => setFixedPay(e.target.value)} 
                    />
                  ) : (
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-field" 
                      value={hourlyRate} 
                      required
                      onChange={(e) => setHourlyRate(e.target.value)} 
                    />
                  )}
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '-8px', marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  id="isFixedPay"
                  checked={isFixedPay}
                  onChange={(e) => setIsFixedPay(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isFixedPay" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>
                  This is a fixed pay shift
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Overtime pay applied" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '8px', marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Calculated Duration: <strong>{calculateDurationHours(startTime, endTime, Number(breakMinutes)).toFixed(2)} hours</strong>
                </p>
                <p style={{ fontSize: '13px', color: 'var(--color-success)', marginTop: '4px' }}>
                  Est. Payout: <strong>{formatCurrency(isFixedPay ? Number(fixedPay) : calculateDurationHours(startTime, endTime, Number(breakMinutes)) * Number(hourlyRate))}</strong>
                </p>
              </div>
            </div>

            <div className="actions-row">
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Save Shift
              </button>
              {editingShift && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => handleDeleteShift(editingShift.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
          </svg>
          Dashboard
        </button>

        <button 
          className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </button>

        <button 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </nav>
    </>
  );
}
