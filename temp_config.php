<?php
$servername = "sql203.infinityfree.com";
$username = "if0_40474342";
$password = "xFxljuC1wQyyK8";
$dbname = "if0_40474342_supra";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>
