/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Accepts an array of warning objects returned from /api/warnings-table.
// Each object has: rID, warningTime, warningMessage, logLocation
export default function data(warningRows = []) {
  const rows = warningRows.map((w) => {
    const dt = w.warningTime ? new Date(w.warningTime) : null;
    const formattedDate = dt
      ? dt.toLocaleString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "N/A";

    return {
      "Warning Time": (
        <MDTypography variant="caption" color="text" fontWeight="medium">
          {formattedDate}
        </MDTypography>
      ),
      "Warning Message": (
        <MDTypography
          variant="caption"
          color="text"
          fontWeight="medium"
          sx={{
            maxWidth: "260px",
            display: "inline-block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={w.warningMessage}
        >
          {w.warningMessage || "—"}
        </MDTypography>
      ),
      "Warning Cause": (
        <MDTypography variant="caption" color="text" fontWeight="medium">
          Rootkit
        </MDTypography>
      ),
      "Warning Status": (
        <MDBadge
          badgeContent="Active"
          color="error"
          variant="gradient"
          size="sm"
        />
      ),
      "Warning Log Location": (
        <MDTypography
          component="span"
          variant="caption"
          color="text"
          fontWeight="medium"
          sx={{
            maxWidth: "200px",
            display: "inline-block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={w.logLocation}
        >
          {w.logLocation || "N/A"}
        </MDTypography>
      ),
    };
  });

  return {
    columns: [
      { Header: "Warning Time", accessor: "Warning Time", width: "20%", align: "left" },
      { Header: "Warning Message", accessor: "Warning Message", align: "left" },
      { Header: "Warning Cause", accessor: "Warning Cause", align: "center" },
      { Header: "Warning Status", accessor: "Warning Status", align: "center" },
      { Header: "Warning Log Location", accessor: "Warning Log Location", align: "center" },
    ],
    rows,
  };
}
