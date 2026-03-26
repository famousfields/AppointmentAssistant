// ...existing code...
import { useState } from "react";

export default function JobForm() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    jobType: "",
    jobDate: "",
    comments: ""
  });
  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    switch (name) {
      case "name":
        if (!value || value.trim().length < 2) return "Enter a valid name (min 2 chars)";
        return "";
      case "phone": {
        const digits = (value || "").replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) return "Enter a valid phone (7-15 digits)";
        return "";
      }
      case "address":
        if (!value || value.trim().length < 5) return "Enter a valid address (min 5 chars)";
        return "";
      case "jobType":
        if (!value || value.trim().length === 0) return "Job type is required";
        return "";
      case "jobDate": {
        if (!value) return "Date is required";
        const d = new Date(value);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (isNaN(d.getTime()) || d < today) return "Date must be today or later";
        return "";
      }
      case "comments":
        if (value && value.length > 500) return "Comments max 500 chars";
        return "";
      default:
        return "";
    }
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    // Only allow numeric characters for phone field
    if (name === "phone") {
      value = value.replace(/\D/g, "");
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(formData).forEach(k => {
      const err = validateField(k, formData[k]);
      if (err) newErrors[k] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    try {
      const res = await fetch("http://localhost:5000/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      console.log(data);
    } catch (err) {
      console.error("Network error:", err);
      setErrors(prev => ({ ...prev, submit: "Network error. Check backend." }));
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <form onSubmit={handleSubmit} noValidate className="job-form">
      <div className="form-group">
        <label>Name</label>
        <input name="name" type="text" required onChange={handleChange} />
        {errors.name && <div className="form-error">{errors.name}</div>}
      </div>

      <div className="form-group">
        <label>Phone</label>
        <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required onChange={handleChange} value={formData.phone} />
        {errors.phone && <div className="form-error">{errors.phone}</div>}
      </div>

      <div className="form-group">
        <label>Address</label>
        <input name="address" type="text" required onChange={handleChange} />
        {errors.address && <div className="form-error">{errors.address}</div>}
      </div>

      <div className="form-group">
        <label>Job Type</label>
        <input name="jobType" type="text" required onChange={handleChange} />
        {errors.jobType && <div className="form-error">{errors.jobType}</div>}
      </div>

      <div className="form-group">
        <label>Date</label>
        <input name="jobDate" type="date" required onChange={handleChange} />
        {errors.jobDate && <div className="form-error">{errors.jobDate}</div>}
      </div>

      <div className="form-group">
        <label>Comments</label>
        <textarea name="comments" onChange={handleChange}></textarea>
        {errors.comments && <div className="form-error">{errors.comments}</div>}
      </div>

      {errors.submit && <div className="form-error-message">{errors.submit}</div>}

      <button type="submit" disabled={hasErrors} className="form-submit-button">Submit</button>
    </form>
  );
}
// ...existing code...