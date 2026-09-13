using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class MultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TenantCompanyId",
                table: "SalesRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "EmployeeRoles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "EmployeeDesignations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompanyId",
                table: "EmployeeDepartments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Companies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OwnerEmail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OwnerContact = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubscriptionExpiry = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsTrial = table.Column<bool>(type: "bit", nullable: false),
                    TrialEndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StaffLimit = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Companies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_CompanyId",
                table: "Users",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesRecords_TenantCompanyId",
                table: "SalesRecords",
                column: "TenantCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeRoles_CompanyId",
                table: "EmployeeRoles",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDesignations_CompanyId",
                table: "EmployeeDesignations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDepartments_CompanyId",
                table: "EmployeeDepartments",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeDepartments_Companies_CompanyId",
                table: "EmployeeDepartments",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeDesignations_Companies_CompanyId",
                table: "EmployeeDesignations",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeRoles_Companies_CompanyId",
                table: "EmployeeRoles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesRecords_Companies_TenantCompanyId",
                table: "SalesRecords",
                column: "TenantCompanyId",
                principalTable: "Companies",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Companies_CompanyId",
                table: "Users",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeDepartments_Companies_CompanyId",
                table: "EmployeeDepartments");

            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeDesignations_Companies_CompanyId",
                table: "EmployeeDesignations");

            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeRoles_Companies_CompanyId",
                table: "EmployeeRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesRecords_Companies_TenantCompanyId",
                table: "SalesRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Companies_CompanyId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "Companies");

            migrationBuilder.DropIndex(
                name: "IX_Users_CompanyId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_SalesRecords_TenantCompanyId",
                table: "SalesRecords");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeRoles_CompanyId",
                table: "EmployeeRoles");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeDesignations_CompanyId",
                table: "EmployeeDesignations");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeDepartments_CompanyId",
                table: "EmployeeDepartments");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TenantCompanyId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "EmployeeRoles");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "EmployeeDesignations");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "EmployeeDepartments");
        }
    }
}
