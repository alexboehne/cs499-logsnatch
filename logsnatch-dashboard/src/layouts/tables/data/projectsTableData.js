/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */

import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Receives the array from /api/warnings-table.
// Each object: { warningTime, scanType, detail, logLocation }
export default function data(warningRows = []) {

  const typeColors = {
    Rootkit:  "error",
    SSH:      "warning",
    SUID:     "info",
    EnvCheck: "success",
  };

  const TypeBadge = ({ type }) => (
    <MDBadge
      badgeContent={type}
      color={typeColors[type] || "dark"}
      variant="gradient"
      size="sm"
    />
  );

  const Text = ({ value, maxWidth }) => (
    <MDTypography
      component="span"
      variant="caption"
      color="text"
      fontWeight="medium"
      title={value}
      sx={
        maxWidth
          ? { maxWidth, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
          : {}
      }
    >
      {value || "—"}
    </MDTypography>
  );

  const rows = warningRows.map((w) => {
    const dt = w.warningTime ? new Date(w.warningTime) : null;
    const formattedDate = dt
      ? dt.toLocaleString("en-US", {
          month: "short", day: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })
      : "N/A";

    return {
      "Time":         <Text value={formattedDate} />,
      "Scan Type":    <TypeBadge type={w.scanType} />,
      "Detail":       <Text value={w.detail} maxWidth="320px" />,
      "Log Location": <Text value={w.logLocation} maxWidth="200px" />,
    };
  });

  return {
    columns: [
      { Header: "Time",         accessor: "Time",         width: "20%", align: "left" },
      { Header: "Scan Type",    accessor: "Scan Type",    width: "10%", align: "center" },
      { Header: "Detail",       accessor: "Detail",       width: "45%", align: "left" },
      { Header: "Log Location", accessor: "Log Location", align: "left" },
    ],
    rows,
  };
}
